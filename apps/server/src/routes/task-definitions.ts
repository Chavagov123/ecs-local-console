import { stripReadOnlyTaskDefFields, taskDefinitionSchema } from "@ecs-local-console/shared";
import type { FastifyPluginAsync } from "fastify";
import { normalizeAwsError } from "../aws/errors.js";
import {
  deregisterTaskDef,
  describeTaskDef,
  listFamilies,
  listRevisions,
  registerTaskDef,
} from "../services/taskdefs.js";

export const taskDefinitionRoutes: FastifyPluginAsync = async (app) => {
  const endpoint = () => app.configStore.get().endpoint;

  app.get("/task-definitions", async () => {
    try {
      return await listFamilies(app.clients, app.cache);
    } catch (err) {
      throw normalizeAwsError(err, endpoint());
    }
  });

  app.get<{ Params: { family: string } }>("/task-definitions/:family", async (req) => {
    try {
      return await listRevisions(app.clients, app.cache, req.params.family);
    } catch (err) {
      throw normalizeAwsError(err, endpoint());
    }
  });

  app.get<{ Params: { family: string; revision: string } }>(
    "/task-definitions/:family/:revision",
    async (req) => {
      try {
        return await describeTaskDef(
          app.clients,
          app.cache,
          `${req.params.family}:${req.params.revision}`,
        );
      } catch (err) {
        throw normalizeAwsError(err, endpoint());
      }
    },
  );

  app.post("/task-definitions", async (req, reply) => {
    const cleaned = stripReadOnlyTaskDefFields(req.body as Record<string, unknown>);
    const parsed = taskDefinitionSchema.safeParse(cleaned);
    if (!parsed.success) {
      return reply.code(400).send({
        error: {
          code: "INVALID_PARAMETER",
          message: parsed.error.issues
            .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
            .join("; "),
          retryable: false,
        },
      });
    }
    try {
      const td = await registerTaskDef(app.clients, app.cache, cleaned);
      return reply.code(201).send(td);
    } catch (err) {
      throw normalizeAwsError(err, endpoint());
    }
  });

  app.delete<{ Params: { family: string; revision: string } }>(
    "/task-definitions/:family/:revision",
    async (req, reply) => {
      try {
        await deregisterTaskDef(
          app.clients,
          app.cache,
          `${req.params.family}:${req.params.revision}`,
        );
        return reply.code(204).send();
      } catch (err) {
        throw normalizeAwsError(err, endpoint());
      }
    },
  );
};
