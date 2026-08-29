import { ECSClient, ListClustersCommand } from "@aws-sdk/client-ecs";
import { mockClient } from "aws-sdk-client-mock";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";

const ecsMock = mockClient(ECSClient);
let app: FastifyInstance;

beforeAll(async () => {
  // Stub the LocalStack /_localstack/health probe so tests don't hit the network.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ version: "4.0.0" }), { status: 200 })),
  );
  app = await buildApp({
    env: { AWS_ENDPOINT_URL: "http://localhost:4566", AWS_REGION: "us-east-1", PORT: "0" },
  });
});
afterAll(async () => {
  await app.close();
  vi.unstubAllGlobals();
});
afterEach(() => ecsMock.reset());

describe("GET /api/health", () => {
  it("reports healthy when ListClusters succeeds", async () => {
    ecsMock.on(ListClustersCommand).resolves({ clusterArns: [] });
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ reachable: true, ecsAvailable: true });
  });

  it("reports unreachable on a connection error", async () => {
    ecsMock.on(ListClustersCommand).rejects(new Error("fetch failed"));
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ reachable: false, ecsAvailable: false });
  });

  it("reports reachable-but-degraded when ECS returns an API error", async () => {
    ecsMock
      .on(ListClustersCommand)
      .rejects(Object.assign(new Error("kaboom"), { name: "InternalFailure" }));
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.json()).toMatchObject({ reachable: true, ecsAvailable: false });
  });
});
