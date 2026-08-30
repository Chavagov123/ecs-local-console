import {
  DescribeServicesCommand,
  DescribeTasksCommand,
  ECSClient,
  ListServicesCommand,
  ListTasksCommand,
} from "@aws-sdk/client-ecs";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ClientRegistry } from "../../src/aws/clients.js";
import { RuntimeConfigStore } from "../../src/config.js";
import { EventEngine, type SseClient } from "../../src/events/engine.js";

const ecsMock = mockClient(ECSClient);

function fakeClient(cluster: string): SseClient & { frames: string[] } {
  const frames: string[] = [];
  return {
    id: `c-${cluster}`,
    clusters: new Set([cluster]),
    write: (f) => frames.push(f),
    frames,
  };
}

function parseFrames(frames: string[]) {
  return frames.flatMap((chunk) =>
    chunk
      .split("\n\n")
      .filter((b) => b.includes("event:"))
      .map((b) => {
        const event = /event: (\S+)/.exec(b)?.[1] ?? "";
        const data = /data: (.+)/.exec(b)?.[1];
        return { event, data: data ? JSON.parse(data) : undefined };
      }),
  );
}

function engine() {
  return new EventEngine(new ClientRegistry(new RuntimeConfigStore({})), { pollMs: 50 });
}

beforeEach(() => {
  ecsMock.reset();
  ecsMock.on(ListServicesCommand).resolves({ serviceArns: [] });
  ecsMock.on(DescribeServicesCommand).resolves({ services: [] });
  ecsMock.on(ListTasksCommand).resolves({ taskArns: [] });
  ecsMock.on(DescribeTasksCommand).resolves({ tasks: [] });
});
afterEach(() => {
  ecsMock.reset();
});

describe("EventEngine", () => {
  it("emits a snapshot every tick and no change on the baseline tick", async () => {
    const e = engine();
    const client = fakeClient("demo");
    e.subscribe(client);

    await e.tick(); // baseline
    const first = parseFrames(client.frames);
    expect(first.some((f) => f.event === "snapshot")).toBe(true);
    expect(first.some((f) => f.event === "change")).toBe(false);

    e.shutdown();
  });

  it("emits task.started once a task appears on the second tick", async () => {
    const e = engine();
    const client = fakeClient("demo");
    e.subscribe(client);

    await e.tick(); // baseline: no tasks
    client.frames.length = 0;

    ecsMock.on(ListTasksCommand).resolves({ taskArns: ["arn:aws:ecs:::task/demo/abc123"] });
    ecsMock.on(DescribeTasksCommand).resolves({
      tasks: [
        {
          taskArn: "arn:aws:ecs:::task/demo/abc123",
          lastStatus: "RUNNING",
          desiredStatus: "RUNNING",
          group: "service:web",
        },
      ],
    });

    await e.tick();
    const changes = parseFrames(client.frames).filter((f) => f.event === "change");
    expect(changes).toHaveLength(1);
    expect(changes[0].data).toMatchObject({ type: "task.started", service: "web" });
    expect(e.lastEventId).toBe(1);

    e.shutdown();
  });

  it("arms the poll loop on first subscriber and clears it when the last leaves", () => {
    const e = engine();
    expect(e.isRunning).toBe(false);

    const a = fakeClient("demo");
    const b = fakeClient("demo");
    e.subscribe(a);
    expect(e.isRunning).toBe(true);
    e.subscribe(b);

    e.unsubscribe(a);
    expect(e.isRunning).toBe(true); // b still connected
    e.unsubscribe(b);
    expect(e.isRunning).toBe(false);
    expect(e.subscriberCount).toBe(0);
  });

  it("replays only events newer than the given id", async () => {
    const e = engine();
    const client = fakeClient("demo");
    e.subscribe(client);
    await e.tick();

    ecsMock.on(ListTasksCommand).resolves({ taskArns: ["arn:aws:ecs:::task/demo/t1"] });
    ecsMock.on(DescribeTasksCommand).resolves({
      tasks: [{ taskArn: "arn:aws:ecs:::task/demo/t1", lastStatus: "RUNNING", desiredStatus: "RUNNING" }],
    });
    await e.tick();

    expect(e.replay(0)).toHaveLength(1);
    expect(e.replay(e.lastEventId)).toHaveLength(0);

    e.shutdown();
  });
});
