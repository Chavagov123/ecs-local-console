import { ECSClient } from "@aws-sdk/client-ecs";
import { mockClient } from "aws-sdk-client-mock";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";

const ecsMock = mockClient(ECSClient);

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp({
    env: { AWS_ENDPOINT_URL: "http://localhost:4566", AWS_REGION: "us-east-1", PORT: "0" },
  });
});
afterAll(async () => {
  await app.close();
});
afterEach(() => ecsMock.reset());

describe("/api/config", () => {
  it("reports the env-sourced endpoint and never leaks credentials", async () => {
    const res = await app.inject({ method: "GET", url: "/api/config" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({
      endpoint: "http://localhost:4566",
      region: "us-east-1",
      endpointIsRemote: false,
      source: "env",
    });
    expect(JSON.stringify(body)).not.toMatch(/secret|accessKeyId/i);
  });

  it("PUT updates the endpoint and flags a remote host", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/config",
      payload: { endpoint: "https://ecs.eu-west-1.amazonaws.com", region: "eu-west-1" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      endpoint: "https://ecs.eu-west-1.amazonaws.com",
      endpointIsRemote: true,
      source: "runtime-override",
    });
  });

  it("PUT rejects a malformed region", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/config",
      payload: { region: "not-a-region" },
    });
    expect(res.statusCode).toBe(400);
  });
});
