import {
  DescribeTasksCommand,
  ECSClient,
  ListTasksCommand,
  RunTaskCommand,
  StopTaskCommand,
} from "@aws-sdk/client-ecs";
import { mockClient } from "aws-sdk-client-mock";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";

const ecsMock = mockClient(ECSClient);
let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({ env: { AWS_ENDPOINT_URL: "http://localhost:4566", PORT: "0" } });
});
afterAll(async () => {
  await app.close();
});
afterEach(() => {
  ecsMock.reset();
  app.cache.invalidate();
});

describe("tasks", () => {
  it("rejects a bad query filter with 400, not 500", async () => {
    const a = await app.inject({ method: "GET", url: "/api/clusters/demo/tasks?desiredStatus=BOGUS" });
    expect(a.statusCode).toBe(400);
    expect(a.json().error.code).toBe("INVALID_PARAMETER");
    const b = await app.inject({ method: "GET", url: "/api/tasks?launchType=nope" });
    expect(b.statusCode).toBe(400);
    expect(ecsMock.commandCalls(ListTasksCommand)).toHaveLength(0);
  });

  it("lists cluster tasks and marks transitions", async () => {
    ecsMock.on(ListTasksCommand).resolves({ taskArns: ["arn:aws:ecs:us-east-1:0:task/demo/abc"] });
    ecsMock.on(DescribeTasksCommand).resolves({
      tasks: [
        {
          taskArn: "arn:aws:ecs:us-east-1:0:task/demo/abcdef012345",
          lastStatus: "PENDING",
          desiredStatus: "RUNNING",
          taskDefinitionArn: "arn:aws:ecs:us-east-1:0:task-definition/web:1",
        },
      ],
    });
    const res = await app.inject({ method: "GET", url: "/api/clusters/demo/tasks" });
    expect(res.statusCode).toBe(200);
    expect(res.json()[0]).toMatchObject({ taskId: "abcdef012345", transitioning: true });
  });

  it("runs a task", async () => {
    ecsMock.on(RunTaskCommand).resolves({
      tasks: [
        {
          taskArn: "arn:aws:ecs:us-east-1:0:task/demo/new1",
          lastStatus: "PROVISIONING",
          desiredStatus: "RUNNING",
        },
      ],
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/clusters/demo/tasks",
      payload: { taskDefinition: "web:1", count: 1, launchType: "FARGATE" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().tasks).toHaveLength(1);
    expect(res.json().failures).toEqual([]);
  });

  it("reports partial placement failures alongside the tasks that started", async () => {
    ecsMock.on(RunTaskCommand).resolves({
      tasks: [
        {
          taskArn: "arn:aws:ecs:us-east-1:0:task/demo/ok1",
          lastStatus: "PENDING",
          desiredStatus: "RUNNING",
        },
      ],
      failures: [
        { arn: "arn:...:container-instance/i-1", reason: "RESOURCE:MEMORY" },
        { arn: "arn:...:container-instance/i-2", reason: "AGENT" },
      ],
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/clusters/demo/tasks",
      payload: { taskDefinition: "web:1", count: 3 },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.tasks).toHaveLength(1);
    expect(body.failures.map((f: { reason: string }) => f.reason)).toEqual([
      "RESOURCE:MEMORY",
      "AGENT",
    ]);
  });

  it("surfaces a total RunTask failure as 400", async () => {
    ecsMock.on(RunTaskCommand).resolves({
      tasks: [],
      failures: [{ reason: "RESOURCE:MEMORY", arn: "x" }],
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/clusters/demo/tasks",
      payload: { taskDefinition: "web:1" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toContain("RESOURCE:MEMORY");
  });

  it("stops a task with a reason", async () => {
    ecsMock.on(StopTaskCommand).resolves({
      task: {
        taskArn: "arn:aws:ecs:us-east-1:0:task/demo/abc",
        lastStatus: "STOPPED",
        desiredStatus: "STOPPED",
      },
    });
    const res = await app.inject({
      method: "DELETE",
      url: "/api/clusters/demo/tasks/abc",
      payload: { reason: "manual" },
    });
    expect(res.statusCode).toBe(200);
    expect(ecsMock.commandCalls(StopTaskCommand)[0]!.args[0].input).toMatchObject({
      task: "abc",
      reason: "manual",
    });
  });

  it("does not report a phantom stop when StopTask echoes no task", async () => {
    ecsMock.on(StopTaskCommand).resolves({});
    const res = await app.inject({ method: "DELETE", url: "/api/clusters/demo/tasks/ghost" });
    expect(res.statusCode).toBe(404);
  });

  it("rejects a malformed stop reason before calling AWS", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/clusters/demo/tasks/abc",
      payload: { reason: "x".repeat(256) },
    });
    expect(res.statusCode).toBe(400);
    expect(ecsMock.commandCalls(StopTaskCommand)).toHaveLength(0);
  });
});
