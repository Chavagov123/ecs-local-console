import type { ServiceSnapshot } from "@ecs-local-console/shared";
import { describe, expect, it } from "vitest";
import { type ClusterState, diffCluster, type TaskSnap } from "../../src/events/diff.js";

let counter = 0;
const ctx = () => ({ cluster: "demo", ts: "2026-01-01T00:00:00Z", nextId: () => ++counter });

function svc(partial: Partial<ServiceSnapshot> & { service: string }): ServiceSnapshot {
  return {
    desired: 1,
    running: 1,
    pending: 0,
    deployments: [
      { id: "d1", taskDefinition: "web:1", status: "PRIMARY", rolloutState: "COMPLETED", desired: 1, running: 1, pending: 0 },
    ],
    ...partial,
  };
}

function task(partial: Partial<TaskSnap> & { taskId: string }): TaskSnap {
  return { lastStatus: "RUNNING", desiredStatus: "RUNNING", ...partial };
}

function state(services: ServiceSnapshot[], tasks: TaskSnap[]): ClusterState {
  return {
    services: new Map(services.map((s) => [s.service, s])),
    tasks: new Map(tasks.map((t) => [t.taskId, t])),
  };
}

describe("diffCluster", () => {
  it("emits nothing on the first observation (baseline)", () => {
    const next = state([svc({ service: "web" })], [task({ taskId: "t1" })]);
    expect(diffCluster(undefined, next, ctx())).toEqual([]);
  });

  it("emits task.started for a new running task", () => {
    const prev = state([svc({ service: "web" })], []);
    const next = state([svc({ service: "web" })], [task({ taskId: "t1", group: "service:web" })]);
    const events = diffCluster(prev, next, ctx());
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "task.started", resource: "t1", service: "web" });
  });

  it("classifies a scheduler stop vs. an error stop vs. a manual stop", () => {
    const prev = state(
      [svc({ service: "web" })],
      [
        task({ taskId: "sched" }),
        task({ taskId: "err" }),
        task({ taskId: "manual" }),
      ],
    );
    const next = state(
      [svc({ service: "web" })],
      [
        task({ taskId: "sched", lastStatus: "STOPPED", stoppedReason: "Scaling activity initiated by deployment" }),
        task({ taskId: "err", lastStatus: "STOPPED", stoppedReason: "Essential container in task exited", exitCode: 1 }),
        task({ taskId: "manual", lastStatus: "STOPPED", stoppedReason: "Stopped from ECS Local Console" }),
      ],
    );
    const events = diffCluster(prev, next, ctx());
    const byId = Object.fromEntries(events.map((e) => [e.resource, e]));
    expect(byId.sched.type).toBe("task.replaced-by-scheduler");
    expect(byId.err).toMatchObject({ type: "task.stopped", severity: "error" });
    expect(byId.err.detail).toContain("exit 1");
    expect(byId.manual).toMatchObject({ type: "task.stopped", severity: "info" });
  });

  it("emits service.deployment.completed on IN_PROGRESS -> COMPLETED", () => {
    const inProg = svc({
      service: "web",
      deployments: [
        { id: "d2", taskDefinition: "web:2", status: "PRIMARY", rolloutState: "IN_PROGRESS", desired: 2, running: 1, pending: 1 },
      ],
    });
    const done = svc({
      service: "web",
      deployments: [
        { id: "d2", taskDefinition: "web:2", status: "PRIMARY", rolloutState: "COMPLETED", desired: 2, running: 2, pending: 0 },
      ],
    });
    const events = diffCluster(state([inProg], []), state([done], []), ctx());
    expect(events.map((e) => e.type)).toContain("service.deployment.completed");
  });

  it("emits service.changed for a desiredCount change and a revision change", () => {
    const before = svc({ service: "web", desired: 2 });
    const after = svc({
      service: "web",
      desired: 4,
      deployments: [
        { id: "d3", taskDefinition: "web:3", status: "PRIMARY", rolloutState: "IN_PROGRESS", desired: 4, running: 2, pending: 2 },
      ],
    });
    const details = diffCluster(state([before], []), state([after], []), ctx())
      .filter((e) => e.type === "service.changed")
      .map((e) => e.detail);
    expect(details).toEqual(expect.arrayContaining(["desired 2 → 4", "web:1 → web:3"]));
  });

  it("treats a vanished (never-STOPPED) task as scheduler churn", () => {
    const prev = state([svc({ service: "web" })], [task({ taskId: "gone", group: "service:web" })]);
    const next = state([svc({ service: "web" })], []);
    const events = diffCluster(prev, next, ctx());
    expect(events[0]).toMatchObject({ type: "task.replaced-by-scheduler", resource: "gone" });
  });
});
