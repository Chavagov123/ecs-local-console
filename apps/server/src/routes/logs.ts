import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { normalizeAwsError } from "../aws/errors.js";
import { taskEnis } from "../services/enis.js";
import { getLogEvents, listLogGroups, taskLogConfig } from "../services/logs.js";
import { parse } from "./validate.js";

const groupsQuery = z.object({
  prefix: z.string().optional(),
  nextToken: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const numeric = z.coerce.number().int().nonnegative();

const eventsQuery = z.object({
  logGroup: z.string().min(1),
  logStream: z.string().optional(),
  start: numeric.optional(),
  end: numeric.optional(),
  filterPattern: z.string().optional(),
  nextToken: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

export const logRoutes: FastifyPluginAsync = async (app) => {
  const endpoint = () => app.configStore.get().endpoint;
  const guard = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      throw normalizeAwsError(err, endpoint());
    }
  };

  app.get("/logs/groups", async (req, reply) => {
    const q = parse(groupsQuery, req.query, reply);
    if (!q) return reply;
    return guard(() => listLogGroups(app.clients, app.cache, q));
  });

  app.get("/logs", async (req, reply) => {
    const q = parse(eventsQuery, req.query, reply);
    if (!q) return reply;
    return guard(() => getLogEvents(app.clients, q));
  });

  app.get<{ Params: { cluster: string; taskId: string } }>(
    "/clusters/:cluster/tasks/:taskId/log-config",
    async (req) =>
      guard(() =>
        taskLogConfig(app.clients, app.cache, req.params.cluster, req.params.taskId),
      ),
  );

  app.get<{ Params: { cluster: string; taskId: string } }>(
    "/clusters/:cluster/tasks/:taskId/enis",
    async (req) =>
      guard(() => taskEnis(app.clients, app.cache, req.params.cluster, req.params.taskId)),
  );
};
