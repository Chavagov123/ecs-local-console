import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { normalizeAwsError } from "../aws/errors.js";
import { createCluster, deleteCluster, describeCluster, listClusters } from "../services/ecs.js";

const createSchema = z.object({
  clusterName: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9_-]+$/, "Letters, numbers, hyphens and underscores only"),
  tags: z.record(z.string()).optional(),
});

export const clusterRoutes: FastifyPluginAsync = async (app) => {
  const endpoint = () => app.configStore.get().endpoint;

  app.get("/clusters", async () => {
    try {
      return await listClusters(app.clients, app.cache);
    } catch (err) {
      throw normalizeAwsError(err, endpoint());
    }
  });

  app.post("/clusters", async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: "BAD_REQUEST",
          message: parsed.error.issues.map((i) => i.message).join("; "),
          retryable: false,
        },
      });
    }
    try {
      const cluster = await createCluster(app.clients, app.cache, parsed.data);
      return reply.code(201).send(cluster);
    } catch (err) {
      throw normalizeAwsError(err, endpoint());
    }
  });

  app.get<{ Params: { cluster: string } }>("/clusters/:cluster", async (req) => {
    try {
      return await describeCluster(app.clients, app.cache, req.params.cluster);
    } catch (err) {
      throw normalizeAwsError(err, endpoint());
    }
  });

  app.delete<{ Params: { cluster: string } }>("/clusters/:cluster", async (req, reply) => {
    try {
      await deleteCluster(app.clients, app.cache, req.params.cluster);
      return reply.code(204).send();
    } catch (err) {
      throw normalizeAwsError(err, endpoint());
    }
  });
};
