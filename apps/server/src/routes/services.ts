import type { FastifyPluginAsync } from "fastify";
import { normalizeAwsError } from "../aws/errors.js";
import { describeService, listServices } from "../services/services.js";
import { listTasks } from "../services/tasks.js";

export const serviceRoutes: FastifyPluginAsync = async (app) => {
  const endpoint = () => app.configStore.get().endpoint;

  app.get<{ Params: { cluster: string } }>("/clusters/:cluster/services", async (req) => {
    try {
      return await listServices(app.clients, app.cache, req.params.cluster);
    } catch (err) {
      throw normalizeAwsError(err, endpoint());
    }
  });

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
