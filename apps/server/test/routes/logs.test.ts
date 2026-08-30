import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
  FilterLogEventsCommand,
  GetLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import {
  DescribeTaskDefinitionCommand,
  DescribeTasksCommand,
  ECSClient,
} from "@aws-sdk/client-ecs";
import { mockClient } from "aws-sdk-client-mock";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";

const logsMock = mockClient(CloudWatchLogsClient);
const ecsMock = mockClient(ECSClient);
let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({ env: { AWS_ENDPOINT_URL: "http://localhost:4566", PORT: "0" } });
});
afterAll(async () => {
  await app.close();
});
afterEach(() => {
  logsMock.reset();
  ecsMock.reset();
  app.cache.invalidate();
});

describe("logs", () => {
  it("lists log groups", async () => {
    logsMock.on(DescribeLogGroupsCommand).resolves({
      logGroups: [{ logGroupName: "/ecs/web", storedBytes: 42, creationTime: 1_700_000_000_000 }],
      nextToken: "n1",
    });
    const res = await app.inject({ method: "GET", url: "/api/logs/groups" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      groups: [{ name: "/ecs/web", storedBytes: 42 }],
      nextToken: "n1",
    });
  });

  it("uses GetLogEvents for a single stream and returns both cursors", async () => {
    logsMock.on(GetLogEventsCommand).resolves({
      events: [{ timestamp: 1000, message: "hello" }],
      nextBackwardToken: "b/1",
      nextForwardToken: "f/1",
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/logs?logGroup=/ecs/web&logStream=web/abc",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      events: [{ message: "hello", timestamp: 1000 }],
      nextBackwardToken: "b/1",
      nextForwardToken: "f/1",
    });
    expect(logsMock.commandCalls(GetLogEventsCommand)).toHaveLength(1);
  });

  it("uses FilterLogEvents when a filterPattern is given", async () => {
    logsMock.on(FilterLogEventsCommand).resolves({
      events: [{ timestamp: 2000, message: "ERROR boom", logStreamName: "web/xyz", eventId: "e1" }],
      nextToken: "next",
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/logs?logGroup=/ecs/web&filterPattern=ERROR",
    });
    expect(res.json().events[0]).toMatchObject({ message: "ERROR boom", eventId: "e1" });
    expect(logsMock.commandCalls(FilterLogEventsCommand)).toHaveLength(1);
  });

  it("resolves per-container log config from the task definition", async () => {
    ecsMock.on(DescribeTasksCommand).resolves({
      tasks: [{ taskArn: "arn:aws:ecs:::task/demo/tid", taskDefinitionArn: "arn:...:task-definition/web:1" }],
    });
    ecsMock.on(DescribeTaskDefinitionCommand).resolves({
      taskDefinition: {
        containerDefinitions: [
          {
            name: "app",
            logConfiguration: {
              logDriver: "awslogs",
              options: { "awslogs-group": "/ecs/web", "awslogs-stream-prefix": "ecs" },
            },
          },
          { name: "sidecar", logConfiguration: { logDriver: "json-file" } },
        ],
      },
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/clusters/demo/tasks/tid/log-config",
    });
    const body = res.json();
    expect(body.containers[0]).toMatchObject({
      container: "app",
      logDriver: "awslogs",
      awslogsGroup: "/ecs/web",
      computedStream: "ecs/app/tid",
    });
    expect(body.containers[1]).toMatchObject({ container: "sidecar", logDriver: "json-file" });
    expect(body.containers[1].hint).toBeTruthy();
  });
});
