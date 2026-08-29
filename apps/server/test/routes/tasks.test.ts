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
    expect(res.json()).toHaveLength(1);
  });

  it("surfaces a RunTask failure as 400", async () => {
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
});
