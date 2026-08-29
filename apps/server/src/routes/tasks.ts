import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { normalizeAwsError } from "../aws/errors.js";
import { listClusters } from "../services/ecs.js";
import { describeTask, listTasks } from "../services/tasks.js";

const listQuery = z.object({
  desiredStatus: z.enum(["RUNNING", "PENDING", "STOPPED"]).optional(),
  family: z.string().optional(),
  startedBy: z.string().optional(),
  launchType: z.enum(["EC2", "FARGATE", "EXTERNAL"]).optional(),
});

export const taskRoutes: FastifyPluginAsync = async (app) => {
  const endpoint = () => app.configStore.get().endpoint;

  app.get<{ Params: { cluster: string } }>("/clusters/:cluster/tasks", async (req) => {
    const filters = listQuery.parse(req.query);
    try {
      return await listTasks(app.clients, app.cache, req.params.cluster, filters);
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

  // Cross-cluster task list for the top-level /tasks page.
  app.get("/tasks", async (req) => {
    const filters = listQuery.parse(req.query);
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
