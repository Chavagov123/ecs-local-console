/**
 * `GET /api/events?cluster=a&cluster=b` — Server-Sent Events stream of live
 * reconciliation frames (`hello`, `snapshot`, `change`). Manual `reply.raw`
 * transport: headers are flushed immediately with a comment line so the Vite
 * dev proxy (and nginx) start forwarding the stream right away.
 */
import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import type { SseClient } from "../events/engine.js";

function frame(event: string, data: unknown, id?: number): string {
  const idLine = id === undefined ? "" : `id: ${id}\n`;
  return `event: ${event}\n${idLine}data: ${JSON.stringify(data)}\n\n`;
}

export const eventRoutes: FastifyPluginAsync = async (app) => {
  if (process.env.EVENTS_DISABLED === "1") return;

  app.get("/events", async (req, reply) => {
    const raw = (req.query as { cluster?: string | string[] }).cluster;
    const clusters = new Set(
      (Array.isArray(raw) ? raw : raw ? [raw] : []).map((s) => s.trim()).filter(Boolean),
    );
    if (clusters.size === 0) {
      return reply.code(400).send({
        error: {
          code: "INVALID_PARAMETER",
          message: "at least one ?cluster= query parameter is required",
          retryable: false,
        },
      });
    }

    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    // Flush headers + tell the client the retry interval before anything else.
    res.write(": ok\n\nretry: 5000\n\n");

    const client: SseClient = {
      id: randomUUID(),
      clusters,
      write: (f) => {
        try {
          res.write(f);
        } catch {
          /* socket already gone; the close handler will clean up */
        }
      },
      bufferedBytes: () => res.writableLength,
    };

    const lastEventId = Number(req.headers["last-event-id"]) || 0;
    try {
      const snapshots = await app.events.snapshotNow([...clusters]);
      client.write(
        frame("hello", { lastEventId: app.events.lastEventId, clusters: snapshots }),
      );
      for (const e of app.events.replay(lastEventId)) {
        if (clusters.has(e.cluster)) client.write(frame("change", e, e.id));
      }
    } catch {
      /* baseline is best-effort — the stream still works without it */
    }

    app.events.subscribe(client);

    const ping = setInterval(() => client.write(": ping\n\n"), 15_000);
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      clearInterval(ping);
      app.events.unsubscribe(client);
    };
    req.raw.on("close", close);
    req.raw.on("error", close);
  });
};
