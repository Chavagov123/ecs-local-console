/**
 * End-to-end lifecycle test against a real AWS-compatible endpoint.
 *
 * Runs only when RUN_INTEGRATION=1:
 *   RUN_INTEGRATION=1 AWS_ENDPOINT_URL=http://localhost:5001 pnpm --filter @ecs-local-console/server test
 *
 * Exercises the full request path: HTTP -> Fastify route -> AWS SDK v3 -> emulator
 * and back, including List*->Describe* hydration and error normalization.
 *
 * TARGET: moto (`python -m moto.server -p 5001`) — no Docker required, which is
 * what CI runs. It is *not* currently portable to LocalStack: the run/stop step
 * depends on a moto-specific launchType/networkMode pairing (see the note on
 * that test). Retargeting to LocalStack means adjusting that one payload.
 */
import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  PutLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";

const RUN = process.env.RUN_INTEGRATION === "1";
const ENDPOINT = process.env.AWS_ENDPOINT_URL ?? "http://localhost:5001";
const suite = RUN ? describe : describe.skip;

// Both names are uniquified: task-definition families are never really deleted
// (deregister only marks a revision INACTIVE), so a fixed family would collide
// with earlier runs against a long-lived LocalStack and shift every revision.
const RUN_ID = Date.now();
const CLUSTER = `elc-e2e-${RUN_ID}`;
const FAMILY = `elc-e2e-web-${RUN_ID}`;

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
      throw new Error(`No emulator reachable at ${ENDPOINT} — start moto first.`);
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

  it("surfaces the emulator's own validation as a normalized 400", async () => {
    // The shared zod schema deliberately leaves memory optional (it's only
    // required per-container, which the emulator enforces), so this exercises
    // the upstream-error path rather than local validation.
    const res = await app.inject({
      method: "POST",
      url: "/api/task-definitions",
      payload: { family: FAMILY, containerDefinitions: [{ name: "app", image: "nginx" }] },
    });
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

  it("runs and stops a standalone task", async () => {
    // NOTE: this payload is deliberately moto-shaped, not ECS-canonical.
    // Real ECS pairs launchType FARGATE with networkMode "awsvpc" — but on
    // moto 5.2.3 that path raises AttributeError ('NetworkInterface' has no
    // 'private_dns_name'), and launchType EC2 needs registered container
    // instances moto has none of. The bridge task definition above with
    // FARGATE is the only combination moto accepts. If this suite is ever
    // pointed at LocalStack, switch to an awsvpc task definition plus a real
    // subnet/security group.
    const run = await app.inject({
      method: "POST",
      url: `/api/clusters/${CLUSTER}/tasks`,
      payload: { taskDefinition: `${FAMILY}:1`, count: 1, launchType: "FARGATE" },
    });
    expect(run.statusCode).toBe(201);
    const { tasks, failures } = run.json();
    expect(tasks.length).toBe(1);
    expect(failures).toEqual([]);
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

  it("registers a new revision, as the editor would", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/task-definitions",
      payload: {
        family: FAMILY,
        // read-only fields the editor might carry over from a describe — must be stripped server-side
        taskDefinitionArn: "arn:aws:ecs:us-east-1:0:task-definition/whatever:9",
        revision: 9,
        status: "ACTIVE",
        networkMode: "bridge",
        containerDefinitions: [
          { name: "app", image: "nginx:latest", essential: true, memory: 256 },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().revision).toBe(2); // 1 from the earlier test, this is 2 — not 9
    const revs = await app.inject({ method: "GET", url: `/api/task-definitions/${FAMILY}` });
    expect(revs.json().map((r: { revision: number }) => r.revision)).toEqual(
      expect.arrayContaining([1, 2]),
    );
  });

  it("serves the form pickers: subnets, security groups, IAM roles", async () => {
    // moto ships a default VPC + roles; these must return 200 with an array
    const subnets = await app.inject({ method: "GET", url: "/api/networking/subnets" });
    expect(subnets.statusCode).toBe(200);
    expect(Array.isArray(subnets.json())).toBe(true);
    expect(subnets.json().length).toBeGreaterThan(0);

    const sgs = await app.inject({ method: "GET", url: "/api/networking/security-groups" });
    expect(sgs.statusCode).toBe(200);
    expect(Array.isArray(sgs.json())).toBe(true);

    const roles = await app.inject({ method: "GET", url: "/api/iam/roles" });
    expect(roles.statusCode).toBe(200);
    expect(Array.isArray(roles.json())).toBe(true);
  });

  it("rejects a bad task-def before touching the emulator (zod)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/task-definitions",
      payload: { family: FAMILY, requiresCompatibilities: ["FARGATE"], networkMode: "bridge" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("INVALID_PARAMETER");
  });

  it("rejects a bad query filter with 400 (not 500)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/clusters/${CLUSTER}/tasks?desiredStatus=NONSENSE`,
    });
    expect(res.statusCode).toBe(400);
  });

  it("reads CloudWatch log events through /api/logs", async () => {
    const logs = new CloudWatchLogsClient({
      endpoint: ENDPOINT,
      region: "us-east-1",
      credentials: { accessKeyId: "test", secretAccessKey: "test" },
    });
    const group = `/elc-e2e/${RUN_ID}`;
    const stream = "app/main/0";
    await logs.send(new CreateLogGroupCommand({ logGroupName: group }));
    await logs.send(new CreateLogStreamCommand({ logGroupName: group, logStreamName: stream }));
    await logs.send(
      new PutLogEventsCommand({
        logGroupName: group,
        logStreamName: stream,
        logEvents: [{ timestamp: Date.now(), message: "hello from the integration test" }],
      }),
    );

    const groups = await app.inject({ method: "GET", url: "/api/logs/groups" });
    expect(groups.statusCode).toBe(200);
    expect(groups.json().groups.map((g: { name: string }) => g.name)).toContain(group);

    const events = await app.inject({
      method: "GET",
      url: `/api/logs?logGroup=${encodeURIComponent(group)}&logStream=${encodeURIComponent(stream)}`,
    });
    expect(events.statusCode).toBe(200);
    expect(events.json().events.map((e: { message: string }) => e.message)).toContain(
      "hello from the integration test",
    );
  });

  it("returns 200 + [] for container instances (moto has none)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/clusters/${CLUSTER}/container-instances`,
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it("deletes the service", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/clusters/${CLUSTER}/services/web-svc?force=true`,
    });
    expect(res.statusCode).toBe(204);
  });
});
