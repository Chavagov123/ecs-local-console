import {
  DescribeTaskDefinitionCommand,
  ECSClient,
  ListTaskDefinitionFamiliesCommand,
  ListTaskDefinitionsCommand,
  RegisterTaskDefinitionCommand,
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

describe("task definitions", () => {
  it("lists families with latest revision", async () => {
    ecsMock.on(ListTaskDefinitionFamiliesCommand).resolves({ families: ["web"] });
    ecsMock.on(ListTaskDefinitionsCommand).resolves({
      taskDefinitionArns: [
        "arn:aws:ecs:us-east-1:0:task-definition/web:3",
        "arn:aws:ecs:us-east-1:0:task-definition/web:2",
      ],
    });
    const res = await app.inject({ method: "GET", url: "/api/task-definitions" });
    expect(res.statusCode).toBe(200);
    expect(res.json()[0]).toMatchObject({ family: "web", latestRevision: 3, activeRevisions: 2 });
  });

  it("rejects an invalid task def before calling AWS", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/task-definitions",
      payload: { family: "web" }, // no containerDefinitions
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("INVALID_PARAMETER");
    expect(ecsMock.commandCalls(RegisterTaskDefinitionCommand)).toHaveLength(0);
  });

  it("strips read-only fields and registers", async () => {
    ecsMock.on(RegisterTaskDefinitionCommand).resolves({
      taskDefinition: {
        family: "web",
        revision: 4,
        taskDefinitionArn: "arn:aws:ecs:us-east-1:0:task-definition/web:4",
        status: "ACTIVE",
        containerDefinitions: [{ name: "app", image: "nginx" }],
      },
    });
    const res = await app.inject({
      method: "POST",
      url: "/api/task-definitions",
      payload: {
        family: "web",
        revision: 3,
        taskDefinitionArn: "arn:aws:ecs:us-east-1:0:task-definition/web:3",
        status: "ACTIVE",
        containerDefinitions: [{ name: "app", image: "nginx" }],
      },
    });
    expect(res.statusCode).toBe(201);
    const call = ecsMock.commandCalls(RegisterTaskDefinitionCommand)[0]!;
    expect(call.args[0].input).not.toHaveProperty("revision");
    expect(call.args[0].input).not.toHaveProperty("taskDefinitionArn");
  });

  it("maps a not-implemented emulator response to 501", async () => {
    ecsMock
      .on(DescribeTaskDefinitionCommand)
      .rejects(Object.assign(new Error("not implemented"), { name: "NotImplementedError" }));
    const res = await app.inject({ method: "GET", url: "/api/task-definitions/web/1" });
    expect(res.statusCode).toBe(501);
    expect(res.json().error.code).toBe("NOT_IMPLEMENTED");
  });
});
