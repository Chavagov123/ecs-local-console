/**
 * Pure diff between two successive poll snapshots of one cluster. Emits the
 * {@link ChangeEvent}s the reconciliation timeline renders. No I/O, no clock —
 * `ts` and `id` are injected so this stays trivially unit-testable.
 */
import type { ChangeEvent, ServiceSnapshot } from "@ecs-local-console/shared";

export interface TaskSnap {
  taskId: string;
  lastStatus: string;
  desiredStatus: string;
  stoppedReason?: string;
  startedBy?: string;
  group?: string;
  /** Exit code of the first non-zero essential container, if any. */
  exitCode?: number;
}

export interface ClusterState {
  /** by service name */
  services: Map<string, ServiceSnapshot>;
  /** by task id */
  tasks: Map<string, TaskSnap>;
}

const RUNNING_ISH = new Set(["PROVISIONING", "PENDING", "ACTIVATING", "RUNNING"]);

const SCHEDULER_REASON =
  /scaling|deployment|being replaced|task failed to start|health check|new deployment|deregistered/i;
const ERROR_REASON =
  /essential container.*(exited|stopped)|out ?of ?memory|oom|cannotpull|resourceinitialization|failed to (pull|start)|error/i;

/** `service:web` → `web`; otherwise undefined. */
export function serviceFromGroup(group: string | undefined): string | undefined {
  return group?.startsWith("service:") ? group.slice("service:".length) : undefined;
}

function isSchedulerStop(t: TaskSnap): boolean {
  if (t.startedBy?.startsWith("ecs-svc/")) return true;
  return !!t.stoppedReason && SCHEDULER_REASON.test(t.stoppedReason);
}

function stopDetail(t: TaskSnap): string | undefined {
  const parts: string[] = [];
  if (t.stoppedReason) parts.push(t.stoppedReason);
  if (typeof t.exitCode === "number" && t.exitCode !== 0) parts.push(`exit ${t.exitCode}`);
  return parts.length ? parts.join(" · ") : undefined;
}

interface DiffCtx {
  cluster: string;
  ts: string;
  nextId: () => number;
}

export function diffCluster(
  prev: ClusterState | undefined,
  next: ClusterState,
  ctx: DiffCtx,
): ChangeEvent[] {
  // First observation of a cluster: record the baseline, emit nothing.
  if (!prev) return [];

  const out: ChangeEvent[] = [];
  const mk = (e: Omit<ChangeEvent, "id" | "cluster" | "ts">): void => {
    out.push({ id: ctx.nextId(), cluster: ctx.cluster, ts: ctx.ts, ...e });
  };

  // --- Services ---
  for (const [name, cur] of next.services) {
    const before = prev.services.get(name);
    if (!before) continue; // brand-new service — its tasks will speak for it

    const prevPrimary = before.deployments.find((d) => d.status === "PRIMARY");
    const curPrimary = cur.deployments.find((d) => d.status === "PRIMARY");

    if (
      prevPrimary &&
      curPrimary &&
      prevPrimary.rolloutState === "IN_PROGRESS" &&
      curPrimary.rolloutState === "COMPLETED"
    ) {
      mk({
        type: "service.deployment.completed",
        resource: name,
        service: name,
        detail: `${curPrimary.taskDefinition} completed`,
      });
    }

    if (prevPrimary && curPrimary && prevPrimary.taskDefinition !== curPrimary.taskDefinition) {
      mk({
        type: "service.changed",
        resource: name,
        service: name,
        detail: `${prevPrimary.taskDefinition} → ${curPrimary.taskDefinition}`,
      });
    }

    if (before.desired !== cur.desired) {
      mk({
        type: "service.changed",
        resource: name,
        service: name,
        detail: `desired ${before.desired} → ${cur.desired}`,
      });
    }
  }

  // --- Tasks ---
  for (const [id, cur] of next.tasks) {
    const before = prev.tasks.get(id);
    const short = id.slice(0, 12);
    const service = serviceFromGroup(cur.group);
    if (!before) {
      if (RUNNING_ISH.has(cur.lastStatus.toUpperCase())) {
        mk({ type: "task.started", resource: id, service, detail: short });
      }
      continue;
    }
    const wasStopped = before.lastStatus.toUpperCase() === "STOPPED";
    const nowStopped = cur.lastStatus.toUpperCase() === "STOPPED";
    if (!wasStopped && nowStopped) {
      if (isSchedulerStop(cur)) {
        mk({
          type: "task.replaced-by-scheduler",
          resource: id,
          service,
          detail: cur.stoppedReason ?? short,
        });
      } else {
        const detail = stopDetail(cur);
        const isError = !!cur.stoppedReason && ERROR_REASON.test(cur.stoppedReason);
        mk({
          type: "task.stopped",
          resource: id,
          service,
          severity: isError ? "error" : "info",
          detail: detail ?? short,
        });
      }
    }
  }

  // Tasks that vanished entirely (never saw them reach STOPPED) — treat as scheduler churn.
  for (const [id, before] of prev.tasks) {
    if (next.tasks.has(id)) continue;
    if (before.lastStatus.toUpperCase() === "STOPPED") continue;
    mk({
      type: "task.replaced-by-scheduler",
      resource: id,
      service: serviceFromGroup(before.group),
      detail: id.slice(0, 12),
    });
  }

  return out;
}
