import type { FastifyPluginAsync } from "fastify";
import { normalizeAwsError } from "../aws/errors.js";
import { listContainerInstances } from "../services/container-instances.js";

export const containerInstanceRoutes: FastifyPluginAsync = async (app) => {
  const endpoint = () => app.configStore.get().endpoint;

  app.get<{ Params: { cluster: string } }>(
    "/clusters/:cluster/container-instances",
    async (req) => {
      try {
        return await listContainerInstances(app.clients, app.cache, req.params.cluster);
      } catch (err) {
        throw normalizeAwsError(err, endpoint());
      }
    },
  );
};
