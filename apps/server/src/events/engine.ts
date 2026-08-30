/**
 * The reconciliation engine. A singleton that, while at least one SSE client is
 * connected, polls every watched cluster on a fixed cadence, diffs successive
 * snapshots into {@link ChangeEvent}s, and pushes `snapshot` + `change` frames
 * to subscribers. Fully idle (no timers) at zero subscribers.
 *
 * It talks to ECS *directly* (not through the read cache) so its cadence is
 * independent and tunable via `EVENTS_POLL_MS`. Cost ≈ 3–4 ECS calls per watched
 * cluster per tick.
 */
import {
  DescribeServicesCommand,
  DescribeTasksCommand,
  ListServicesCommand,
  ListTasksCommand,
  type Service,
  type Task,
} from "@aws-sdk/client-ecs";
import type {
  ChangeEvent,
  ClusterSnapshot,
  ServiceSnapshot,
  SnapshotDeployment,
} from "@ecs-local-console/shared";
import type { ClientRegistry } from "../aws/clients.js";
import { chunk, nonNeg } from "../services/ecs.js";
import { type ClusterState, diffCluster, type TaskSnap } from "./diff.js";

export interface SseClient {
  id: string;
  clusters: Set<string>;
  /** Write a raw SSE frame. Must not throw. */
  write: (frame: string) => void;
  /** Bytes buffered but not yet flushed to the socket, for backpressure. */
  bufferedBytes?: () => number;
}

interface Watched {
  prev?: ClusterState;
  /** True until the first successful poll — suppresses the initial event storm. */
  needsBaseline: boolean;
}

const POLL_MS = clampInt(process.env.EVENTS_POLL_MS, 2000, 250, 60_000);
const RING_MAX = 200;
const MAX_BUFFERED = 1_000_000;

function clampInt(raw: string | undefined, dflt: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function tdName(arn: string | undefined): string {
  if (!arn) return "";
  return arn.includes("task-definition/")
    ? arn.slice(arn.indexOf("task-definition/") + "task-definition/".length)
    : arn;
}

function taskIdFromArn(arn: string | undefined): string {
  return arn ? arn.slice(arn.lastIndexOf("/") + 1) : "";
}

function toSnapshotDeployment(d: NonNullable<Service["deployments"]>[number]): SnapshotDeployment {
  return {
    id: d.id ?? "",
    taskDefinition: tdName(d.taskDefinition),
    status: d.status ?? "",
    rolloutState: d.rolloutState,
    desired: nonNeg(d.desiredCount),
    running: nonNeg(d.runningCount),
    pending: nonNeg(d.pendingCount),
  };
}

function toServiceSnapshot(s: Service): ServiceSnapshot {
  const deployments = (s.deployments ?? []).map(toSnapshotDeployment);
  const primary = deployments.find((d) => d.status === "PRIMARY");
  return {
    service: s.serviceName ?? "",
    desired: nonNeg(s.desiredCount),
    running: nonNeg(s.runningCount),
    pending: nonNeg(s.pendingCount),
    rolloutState: primary?.rolloutState,
    rolloutStateReason: s.deployments?.find((d) => d.status === "PRIMARY")?.rolloutStateReason,
    deployments,
  };
}

function firstBadExitCode(t: Task): number | undefined {
  for (const c of t.containers ?? []) {
    if (typeof c.exitCode === "number" && c.exitCode !== 0) return c.exitCode;
  }
  return undefined;
}

function toTaskSnap(t: Task): TaskSnap {
  return {
    taskId: taskIdFromArn(t.taskArn),
    lastStatus: t.lastStatus ?? "UNKNOWN",
    desiredStatus: t.desiredStatus ?? t.lastStatus ?? "UNKNOWN",
    stoppedReason: t.stoppedReason,
    startedBy: t.startedBy,
    group: t.group,
    exitCode: firstBadExitCode(t),
  };
}

export class EventEngine {
  private readonly subscribers = new Set<SseClient>();
  private readonly watched = new Map<string, Watched>();
  private timer: NodeJS.Timeout | undefined;
  private seq = 0;
  private ring: ChangeEvent[] = [];
  private ticking = false;

  constructor(
    private readonly clients: ClientRegistry,
    private readonly opts: { pollMs?: number } = {},
  ) {}

  get pollMs(): number {
    return this.opts.pollMs ?? POLL_MS;
  }

  get lastEventId(): number {
    return this.seq;
  }

  /** Whether the poll loop timer is currently armed (tests + diagnostics). */
  get isRunning(): boolean {
    return this.timer !== undefined;
  }

  get subscriberCount(): number {
    return this.subscribers.size;
  }

  /** Events with id > `sinceId`, oldest first (for `Last-Event-ID` replay). */
  replay(sinceId: number): ChangeEvent[] {
    return this.ring.filter((e) => e.id > sinceId);
  }

  subscribe(client: SseClient): void {
    this.subscribers.add(client);
    for (const c of client.clusters) {
      if (!this.watched.has(c)) this.watched.set(c, { needsBaseline: true });
    }
    if (this.subscribers.size === 1) this.start();
  }

  unsubscribe(client: SseClient): void {
    if (!this.subscribers.delete(client)) return;
    this.recomputeWatched();
    if (this.subscribers.size === 0) this.stop();
  }

  /** Stop the loop and forget every subscriber (app shutdown). */
  shutdown(): void {
    this.subscribers.clear();
    this.watched.clear();
    this.stop();
  }

  /** Endpoint changed under us — re-baseline silently on the next tick. */
  resetBaselines(): void {
    for (const w of this.watched.values()) {
      w.prev = undefined;
      w.needsBaseline = true;
    }
  }

  /** Current baseline for a set of clusters — used to build the `hello` frame. */
  async snapshotNow(clusters: string[]): Promise<ClusterSnapshot[]> {
    const out: ClusterSnapshot[] = [];
    for (const cluster of clusters) {
      try {
        const { snapshot } = await this.pollCluster(cluster);
        out.push(snapshot);
      } catch {
        out.push({ cluster, ts: new Date().toISOString(), services: [] });
      }
    }
    return out;
  }

  private recomputeWatched(): void {
    const live = new Set<string>();
    for (const c of this.subscribers) for (const cl of c.clusters) live.add(cl);
    for (const key of [...this.watched.keys()]) {
      if (!live.has(key)) this.watched.delete(key);
    }
    for (const cl of live) {
      if (!this.watched.has(cl)) this.watched.set(cl, { needsBaseline: true });
    }
  }

  private start(): void {
    if (this.timer) return;
    const schedule = () => {
      // Don't re-arm if everyone left while a tick was in flight.
      if (this.subscribers.size === 0) return;
      this.timer = setTimeout(() => {
        void this.tick().finally(schedule);
      }, this.pollMs);
    };
    // Arm the timer synchronously (so `isRunning` is true immediately) *and*
    // kick a first tick now so `snapshot` frames flow without a poll delay.
    this.timer = setTimeout(() => {
      void this.tick().finally(schedule);
    }, 0);
  }

  private stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    for (const w of this.watched.values()) {
      w.prev = undefined;
      w.needsBaseline = true;
    }
  }

  /** One poll of every watched cluster. Exposed for tests. */
  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const ts = new Date().toISOString();
      for (const [cluster, w] of this.watched) {
        try {
          const { state, snapshot } = await this.pollCluster(cluster);
          this.emitToCluster(cluster, `event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);

          if (w.needsBaseline) {
            w.prev = state;
            w.needsBaseline = false;
            continue;
          }
          let localSeq = this.seq;
          const events = diffCluster(w.prev, state, {
            cluster,
            ts,
            nextId: () => (localSeq += 1),
          });
          w.prev = state;
          if (events.length) {
            this.seq = localSeq;
            for (const e of events) {
              this.ring.push(e);
              this.emitToCluster(
                cluster,
                `event: change\nid: ${e.id}\ndata: ${JSON.stringify(e)}\n\n`,
              );
            }
            if (this.ring.length > RING_MAX) this.ring = this.ring.slice(-RING_MAX);
          }
        } catch {
          // One cluster's failure (e.g. 501 on an emulator) must not stop the loop.
        }
      }
    } finally {
      this.ticking = false;
    }
  }

  private emitToCluster(cluster: string, frame: string): void {
    for (const client of this.subscribers) {
      if (!client.clusters.has(cluster)) continue;
      if ((client.bufferedBytes?.() ?? 0) > MAX_BUFFERED) {
        this.subscribers.delete(client);
        this.recomputeWatched();
        continue;
      }
      client.write(frame);
    }
  }

  private async pollCluster(
    cluster: string,
  ): Promise<{ state: ClusterState; snapshot: ClusterSnapshot }> {
    const ecs = this.clients.ecs();

    // Services
    const serviceArns: string[] = [];
    let sToken: string | undefined;
    do {
      const page = await ecs.send(new ListServicesCommand({ cluster, nextToken: sToken }));
      serviceArns.push(...(page.serviceArns ?? []));
      sToken = page.nextToken;
    } while (sToken);

    const services = new Map<string, ServiceSnapshot>();
    for (const group of chunk(serviceArns, 10)) {
      const desc = await ecs.send(new DescribeServicesCommand({ cluster, services: group }));
      for (const s of desc.services ?? []) {
        const snap = toServiceSnapshot(s);
        if (snap.service) services.set(snap.service, snap);
      }
    }

    // Tasks: running now + recently stopped (first page only, to bound cost).
    const taskArns = new Set<string>();
    let tToken: string | undefined;
    do {
      const page = await ecs.send(new ListTasksCommand({ cluster, nextToken: tToken }));
      for (const a of page.taskArns ?? []) taskArns.add(a);
      tToken = page.nextToken;
    } while (tToken);
    const stopped = await ecs.send(
      new ListTasksCommand({ cluster, desiredStatus: "STOPPED" }),
    );
    for (const a of stopped.taskArns ?? []) taskArns.add(a);

    const tasks = new Map<string, TaskSnap>();
    for (const grp of chunk([...taskArns], 100)) {
      const desc = await ecs.send(new DescribeTasksCommand({ cluster, tasks: grp }));
      for (const t of desc.tasks ?? []) {
        const snap = toTaskSnap(t);
        if (snap.taskId) tasks.set(snap.taskId, snap);
      }
    }

    return {
      state: { services, tasks },
      snapshot: {
        cluster,
        ts: new Date().toISOString(),
        services: [...services.values()].sort((a, b) => a.service.localeCompare(b.service)),
      },
    };
  }
}
