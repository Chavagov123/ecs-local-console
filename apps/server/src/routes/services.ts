import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { normalizeAwsError } from "../aws/errors.js";
import {
  createService,
  deleteService,
  describeService,
  listServices,
  updateService,
} from "../services/services.js";
import { listTasks } from "../services/tasks.js";

const awsvpc = z.object({
  subnets: z.array(z.string()).min(1),
  securityGroups: z.array(z.string()).optional(),
  assignPublicIp: z.enum(["ENABLED", "DISABLED"]).optional(),
});

const createSchema = z.object({
  serviceName: z.string().min(1),
  taskDefinition: z.string().min(1),
  desiredCount: z.number().int().min(0).optional(),
  launchType: z.enum(["EC2", "FARGATE", "EXTERNAL"]).optional(),
  schedulingStrategy: z.enum(["REPLICA", "DAEMON"]).optional(),
  networkConfiguration: z.object({ awsvpcConfiguration: awsvpc }).optional(),
  loadBalancers: z.array(z.record(z.any())).optional(),
  role: z.string().optional(),
  tags: z.record(z.string()).optional(),
});

const updateSchema = z.object({
  desiredCount: z.number().int().min(0).optional(),
  taskDefinition: z.string().min(1).optional(),
  forceNewDeployment: z.boolean().optional(),
  networkConfiguration: z.object({ awsvpcConfiguration: awsvpc }).optional(),
});

function toTags(tags?: Record<string, string>) {
  return tags ? Object.entries(tags).map(([key, value]) => ({ key, value })) : undefined;
}

export const serviceRoutes: FastifyPluginAsync = async (app) => {
  const endpoint = () => app.configStore.get().endpoint;

  app.get<{ Params: { cluster: string } }>("/clusters/:cluster/services", async (req) => {
    try {
      return await listServices(app.clients, app.cache, req.params.cluster);
    } catch (err) {
      throw normalizeAwsError(err, endpoint());
    }
  });

  app.post<{ Params: { cluster: string } }>(
    "/clusters/:cluster/services",
    async (req, reply) => {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: {
            code: "INVALID_PARAMETER",
            message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
            retryable: false,
          },
        });
      }
      const { tags, ...rest } = parsed.data;
      try {
        const svc = await createService(app.clients, app.cache, req.params.cluster, {
          ...rest,
          tags: toTags(tags),
        });
        return reply.code(201).send(svc);
      } catch (err) {
        throw normalizeAwsError(err, endpoint());
      }
    },
  );

  app.get<{ Params: { cluster: string; service: string } }>(
    "/clusters/:cluster/services/:service",
    async (req) => {
      try {
        return await describeService(
          app.clients,
          app.cache,
          req.params.cluster,
          req.params.service,
        );
      } catch (err) {
        throw normalizeAwsError(err, endpoint());
      }
    },
  );

  app.patch<{ Params: { cluster: string; service: string } }>(
    "/clusters/:cluster/services/:service",
    async (req, reply) => {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: {
            code: "INVALID_PARAMETER",
            message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
            retryable: false,
          },
        });
      }
      try {
        return await updateService(
          app.clients,
          app.cache,
          req.params.cluster,
          req.params.service,
          parsed.data,
        );
      } catch (err) {
        throw normalizeAwsError(err, endpoint());
      }
    },
  );

  app.delete<{ Params: { cluster: string; service: string }; Querystring: { force?: string } }>(
    "/clusters/:cluster/services/:service",
    async (req, reply) => {
      try {
        await deleteService(
          app.clients,
          app.cache,
          req.params.cluster,
          req.params.service,
          req.query.force === "true",
        );
        return reply.code(204).send();
      } catch (err) {
        throw normalizeAwsError(err, endpoint());
      }
    },
  );

  app.get<{ Params: { cluster: string; service: string } }>(
    "/clusters/:cluster/services/:service/tasks",
    async (req) => {
      try {
        return await listTasks(app.clients, app.cache, req.params.cluster, {
          serviceName: req.params.service,
        });
      } catch (err) {
        throw normalizeAwsError(err, endpoint());
      }
    },
  );
};
