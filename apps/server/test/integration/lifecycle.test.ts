/**
 * End-to-end lifecycle test against a real AWS-compatible endpoint.
 *
 * Runs only when RUN_INTEGRATION=1. Point AWS_ENDPOINT_URL at a live emulator:
 *   - moto:       python -m moto.server -p 5001   (no Docker needed)
 *   - LocalStack: pnpm dev:stack                  (port 4566)
 *
 *   RUN_INTEGRATION=1 AWS_ENDPOINT_URL=http://localhost:5001 pnpm --filter @ecs-local-console/server test
 *
 * Exercises the full request path: HTTP -> Fastify route -> AWS SDK v3 -> emulator
 * and back, including List*->Describe* hydration and error normalization.
 */
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";

const RUN = process.env.RUN_INTEGRATION === "1";
const ENDPOINT = process.env.AWS_ENDPOINT_URL ?? "http://localhost:5001";
const suite = RUN ? describe : describe.skip;

const CLUSTER = `elc-e2e-${Date.now()}`;
const FAMILY = `elc-e2e-web`;

suite(`lifecycle @ ${ENDPOINT}`, () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({
      env: {
        AWS_ENDPOINT_URL: ENDPOINT,
        AWS_REGION: "us-east-1",
        AWS_ACCESS_KEY_ID: "test",
        AWS_SECRET_ACCESS_KEY: "test",
        PORT: "0",
      },
    });
    const health = await app.inject({ method: "GET", url: "/api/health" });
    if (!health.json().reachable) {
      throw new Error(`No emulator reachable at ${ENDPOINT} — start moto or LocalStack first.`);
    }
  });

  afterAll(async () => {
    if (!app) return;
    await app.inject({ method: "DELETE", url: `/api/clusters/${CLUSTER}/services/web-svc?force=true` });
    await app.inject({ method: "DELETE", url: `/api/clusters/${CLUSTER}` });
    await app.close();
  });

  it("creates a cluster and lists it", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/clusters",
      payload: { clusterName: CLUSTER },
    });
    expect(create.statusCode).toBe(201);

    const list = await app.inject({ method: "GET", url: "/api/clusters" });
    expect(list.statusCode).toBe(200);
    expect(list.json().map((c: { name: string }) => c.name)).toContain(CLUSTER);
  });

  it("rejects an invalid task definition with a 400 from the emulator", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/task-definitions",
      payload: { family: FAMILY, containerDefinitions: [{ name: "app", image: "nginx" }] },
    });
    // moto/LocalStack both require memory or memoryReservation on the container.
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("INVALID_PARAMETER");
  });

  it("registers a task definition", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/task-definitions",
      payload: {
        family: FAMILY,
        networkMode: "bridge",
        containerDefinitions: [
          { name: "app", image: "nginx:latest", essential: true, memory: 256 },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ family: FAMILY, revision: 1 });

    const families = await app.inject({ method: "GET", url: "/api/task-definitions" });
    expect(families.json().map((f: { family: string }) => f.family)).toContain(FAMILY);
  });

  it("creates a service and derives deploymentInProgress", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/clusters/${CLUSTER}/services`,
      payload: {
        serviceName: "web-svc",
        taskDefinition: `${FAMILY}:1`,
        desiredCount: 2,
        launchType: "EC2",
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.desiredCount).toBe(2);
    expect(body.deploymentInProgress).toBe(true);
    expect(body.deployments.length).toBeGreaterThan(0);
  });

  it("scales the service via PATCH desiredCount", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/clusters/${CLUSTER}/services/web-svc`,
      payload: { desiredCount: 4 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().desiredCount).toBe(4);
  });

  it("runs and stops a standalone FARGATE task", async () => {
    const run = await app.inject({
      method: "POST",
      url: `/api/clusters/${CLUSTER}/tasks`,
      payload: { taskDefinition: `${FAMILY}:1`, count: 1, launchType: "FARGATE" },
    });
    expect(run.statusCode).toBe(201);
    const tasks = run.json();
    expect(tasks.length).toBe(1);
    const taskId = tasks[0].taskId as string;

    const describe = await app.inject({
      method: "GET",
      url: `/api/clusters/${CLUSTER}/tasks/${taskId}`,
    });
    expect(describe.statusCode).toBe(200);
    expect(describe.json().containers.length).toBeGreaterThan(0);

    const stop = await app.inject({
      method: "DELETE",
      url: `/api/clusters/${CLUSTER}/tasks/${taskId}`,
      payload: { reason: "integration test" },
    });
    expect(stop.statusCode).toBe(200);
  });

  it("404s a missing cluster", async () => {
    const res = await app.inject({ method: "GET", url: "/api/clusters/does-not-exist-xyz" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND");
  });

  it("deletes the service", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/clusters/${CLUSTER}/services/web-svc?force=true`,
    });
    expect(res.statusCode).toBe(204);
  });
});
