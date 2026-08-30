import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { normalizeAwsError } from "../aws/errors.js";
import { listClusters } from "../services/ecs.js";
import { describeTask, listTasks, runTask, stopTask } from "../services/tasks.js";
import { parse } from "./validate.js";

const listQuery = z.object({
  desiredStatus: z.enum(["RUNNING", "PENDING", "STOPPED"]).optional(),
  family: z.string().optional(),
  startedBy: z.string().optional(),
  launchType: z.enum(["EC2", "FARGATE", "EXTERNAL"]).optional(),
});

const awsvpc = z.object({
  subnets: z.array(z.string()).min(1),
  securityGroups: z.array(z.string()).optional(),
  assignPublicIp: z.enum(["ENABLED", "DISABLED"]).optional(),
});

const runSchema = z.object({
  taskDefinition: z.string().min(1),
  count: z.number().int().min(1).max(10).optional(),
  launchType: z.enum(["EC2", "FARGATE", "EXTERNAL"]).optional(),
  group: z.string().optional(),
  startedBy: z.string().optional(),
  networkConfiguration: z.object({ awsvpcConfiguration: awsvpc }).optional(),
  overrides: z.record(z.any()).optional(),
});

// AWS caps StopTask `reason` at 255 characters.
const stopSchema = z.object({
  reason: z.string().max(255).optional(),
});

export const taskRoutes: FastifyPluginAsync = async (app) => {
  const endpoint = () => app.configStore.get().endpoint;

  app.get<{ Params: { cluster: string } }>("/clusters/:cluster/tasks", async (req, reply) => {
    const filters = parse(listQuery, req.query, reply);
    if (!filters) return reply;
    try {
      return await listTasks(app.clients, app.cache, req.params.cluster, filters);
    } catch (err) {
      throw normalizeAwsError(err, endpoint());
    }
  });

  app.post<{ Params: { cluster: string } }>("/clusters/:cluster/tasks", async (req, reply) => {
    const body = parse(runSchema, req.body, reply);
    if (!body) return reply;
    try {
      const tasks = await runTask(app.clients, app.cache, req.params.cluster, body);
      return reply.code(201).send(tasks);
    } catch (err) {
      throw normalizeAwsError(err, endpoint());
    }
  });

  app.get<{ Params: { cluster: string; taskId: string } }>(
    "/clusters/:cluster/tasks/:taskId",
    async (req) => {
      try {
        return await describeTask(app.clients, app.cache, req.params.cluster, req.params.taskId);
      } catch (err) {
        throw normalizeAwsError(err, endpoint());
      }
    },
  );

  app.delete<{ Params: { cluster: string; taskId: string } }>(
    "/clusters/:cluster/tasks/:taskId",
    async (req, reply) => {
      const body = parse(stopSchema, req.body ?? {}, reply);
      if (!body) return reply;
      try {
        return await stopTask(
          app.clients,
          app.cache,
          req.params.cluster,
          req.params.taskId,
          body.reason,
        );
      } catch (err) {
        throw normalizeAwsError(err, endpoint());
      }
    },
  );

  // Cross-cluster task list for the top-level /tasks page.
  app.get("/tasks", async (req, reply) => {
    const filters = parse(listQuery, req.query, reply);
    if (!filters) return reply;
    try {
      const clusters = await listClusters(app.clients, app.cache);
      const perCluster = await Promise.all(
        clusters.map((c) => listTasks(app.clients, app.cache, c.name, filters)),
      );
      return perCluster.flat().sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    } catch (err) {
      throw normalizeAwsError(err, endpoint());
    }
  });
};
