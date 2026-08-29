import {
  CreateClusterCommand,
  DescribeClustersCommand,
  ECSClient,
  ListClustersCommand,
} from "@aws-sdk/client-ecs";
import { mockClient } from "aws-sdk-client-mock";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";

const ecsMock = mockClient(ECSClient);

const TEST_ENV = {
  AWS_ENDPOINT_URL: "http://localhost:4566",
  AWS_REGION: "us-east-1",
  AWS_ACCESS_KEY_ID: "test",
  AWS_SECRET_ACCESS_KEY: "test",
  PORT: "0",
} satisfies NodeJS.ProcessEnv;

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp({ env: TEST_ENV });
});
afterAll(async () => {
  await app.close();
});
afterEach(() => {
  ecsMock.reset();
  app.cache.invalidate();
});

describe("GET /api/clusters", () => {
  it("hydrates ListClusters via DescribeClusters", async () => {
    ecsMock
      .on(ListClustersCommand)
      .resolves({ clusterArns: ["arn:aws:ecs:us-east-1:000000000000:cluster/demo"] });
    ecsMock.on(DescribeClustersCommand).resolves({
      clusters: [
        {
          clusterName: "demo",
          clusterArn: "arn:aws:ecs:us-east-1:000000000000:cluster/demo",
          status: "ACTIVE",
          runningTasksCount: 2,
          pendingTasksCount: 1,
          activeServicesCount: 1,
          registeredContainerInstancesCount: 0,
        },
      ],
    });

    const res = await app.inject({ method: "GET", url: "/api/clusters" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ name: "demo", status: "ACTIVE", runningTasksCount: 2 });
  });

  it("returns [] when there are no clusters", async () => {
    ecsMock.on(ListClustersCommand).resolves({ clusterArns: [] });
    const res = await app.inject({ method: "GET", url: "/api/clusters" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("maps a connection refusal to 503 LOCALSTACK_UNREACHABLE", async () => {
    ecsMock.on(ListClustersCommand).rejects(Object.assign(new Error("connect ECONNREFUSED"), {
      code: "ECONNREFUSED",
    }));
    const res = await app.inject({ method: "GET", url: "/api/clusters" });
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe("LOCALSTACK_UNREACHABLE");
    expect(res.json().error.retryable).toBe(true);
  });

  it("maps InvalidParameterException to 400", async () => {
    ecsMock.on(ListClustersCommand).rejects(
      Object.assign(new Error("bad input"), { name: "InvalidParameterException" }),
    );
    const res = await app.inject({ method: "GET", url: "/api/clusters" });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("INVALID_PARAMETER");
  });
});

describe("POST /api/clusters", () => {
  it("rejects an invalid cluster name before calling AWS", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/clusters",
      payload: { clusterName: "bad name!" },
    });
    expect(res.statusCode).toBe(400);
    expect(ecsMock.commandCalls(CreateClusterCommand)).toHaveLength(0);
  });

  it("creates a cluster", async () => {
    ecsMock.on(CreateClusterCommand).resolves({
      cluster: { clusterName: "demo", status: "ACTIVE" },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/clusters",
      payload: { clusterName: "demo" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().name).toBe("demo");
  });
});
