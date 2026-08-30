import { ECSClient, TagResourceCommand, UntagResourceCommand } from "@aws-sdk/client-ecs";
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

describe("tags", () => {
  it("adds tags via TagResource and returns 204", async () => {
    ecsMock.on(TagResourceCommand).resolves({});
    const res = await app.inject({
      method: "POST",
      url: "/api/tags",
      payload: {
        resourceArn: "arn:aws:ecs:us-east-1:0:service/demo/web",
        tags: { env: "dev", team: "core" },
      },
    });
    expect(res.statusCode).toBe(204);
    expect(ecsMock.commandCalls(TagResourceCommand)[0]!.args[0].input).toMatchObject({
      resourceArn: "arn:aws:ecs:us-east-1:0:service/demo/web",
      tags: [
        { key: "env", value: "dev" },
        { key: "team", value: "core" },
      ],
    });
  });

  it("removes tags via UntagResource", async () => {
    ecsMock.on(UntagResourceCommand).resolves({});
    const res = await app.inject({
      method: "DELETE",
      url: "/api/tags",
      payload: {
        resourceArn: "arn:aws:ecs:us-east-1:0:cluster/demo",
        tagKeys: ["env"],
      },
    });
    expect(res.statusCode).toBe(204);
    expect(ecsMock.commandCalls(UntagResourceCommand)[0]!.args[0].input).toMatchObject({
      tagKeys: ["env"],
    });
  });

  it("rejects a body with no tagKeys", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/tags",
      payload: { resourceArn: "arn:aws:ecs:us-east-1:0:cluster/demo", tagKeys: [] },
    });
    expect(res.statusCode).toBe(400);
  });
});
