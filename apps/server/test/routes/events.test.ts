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
let base: string;

beforeAll(async () => {
  app = await buildApp({ env: { AWS_ENDPOINT_URL: "http://localhost:4566", PORT: "0" } });
  await app.listen({ port: 0, host: "127.0.0.1" });
  const addr = app.server.address();
  base = typeof addr === "object" && addr ? `http://127.0.0.1:${addr.port}` : "";
});
afterAll(async () => {
  // Force-close so a still-open SSE socket can't hang the suite teardown.
  await app.close();
});
afterEach(() => {
  ecsMock.reset();
  app.cache.invalidate();
});

/** Collect SSE frames for up to `windowMs`, then abort. Never blocks past that. */
async function collectFrames(url: string, windowMs = 2500) {
  ecsMock.on(ListServicesCommand).resolves({ serviceArns: [] });
  ecsMock.on(DescribeServicesCommand).resolves({ services: [] });
  ecsMock.on(ListTasksCommand).resolves({ taskArns: [] });
  ecsMock.on(DescribeTasksCommand).resolves({ tasks: [] });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), windowMs);
  const frames: { event: string; data: unknown }[] = [];
  try {
    const res = await fetch(url, { headers: { accept: "text/event-stream" }, signal: ctrl.signal });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const p of parts) {
        const event = /event: (\S+)/.exec(p)?.[1];
        if (!event) continue;
        const dataLine = /data: (.+)/.exec(p)?.[1];
        frames.push({ event, data: dataLine ? JSON.parse(dataLine) : undefined });
      }
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") throw err;
  } finally {
    clearTimeout(timer);
  }
  return frames;
}

describe("GET /api/events", () => {
  it("400s without a ?cluster", async () => {
    const res = await app.inject({ method: "GET", url: "/api/events" });
    expect(res.statusCode).toBe(400);
  });

  it("streams hello + snapshot frames for a watched cluster", async () => {
    const frames = await collectFrames(`${base}/api/events?cluster=demo`);
    expect(frames.some((f) => f.event === "hello")).toBe(true);
    expect(frames.some((f) => f.event === "snapshot")).toBe(true);
  }, 10_000);
});
