import {
  DescribeServicesCommand,
  DescribeTasksCommand,
  ECSClient,
  ListServicesCommand,
  ListTasksCommand,
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

describe("services", () => {
  it("lists services with deployment-in-progress derived", async () => {
    ecsMock.on(ListServicesCommand).resolves({
      serviceArns: ["arn:aws:ecs:us-east-1:0:service/demo/web"],
    });
    ecsMock.on(DescribeServicesCommand).resolves({
      services: [
        {
          serviceName: "web",
          serviceArn: "arn:aws:ecs:us-east-1:0:service/demo/web",
          status: "ACTIVE",
          desiredCount: 3,
          runningCount: 1,
          pendingCount: 2,
          taskDefinition: "arn:aws:ecs:us-east-1:0:task-definition/web:2",
          deployments: [{ rolloutState: "IN_PROGRESS" }],
        },
      ],
    });

    const res = await app.inject({ method: "GET", url: "/api/clusters/demo/services" });
    expect(res.statusCode).toBe(200);
    expect(res.json()[0]).toMatchObject({
      name: "web",
      taskDefinition: "web:2",
      deploymentInProgress: true,
    });
  });

  it("404s a missing service", async () => {
    ecsMock.on(DescribeServicesCommand).resolves({ services: [] });
    const res = await app.inject({ method: "GET", url: "/api/clusters/demo/services/nope" });
    expect(res.statusCode).toBe(404);
  });

  it("lists a service's tasks", async () => {
    ecsMock.on(ListTasksCommand).resolves({ taskArns: ["arn:aws:ecs:us-east-1:0:task/demo/abc"] });
    ecsMock.on(DescribeTasksCommand).resolves({
      tasks: [
        {
          taskArn: "arn:aws:ecs:us-east-1:0:task/demo/abc123456789",
          lastStatus: "RUNNING",
          desiredStatus: "RUNNING",
          taskDefinitionArn: "arn:aws:ecs:us-east-1:0:task-definition/web:2",
        },
      ],
    });
    const res = await app.inject({
      method: "GET",
      url: "/api/clusters/demo/services/web/tasks",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()[0]).toMatchObject({ taskId: "abc123456789", transitioning: false });
  });
});
