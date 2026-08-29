import type { FastifyPluginAsync } from "fastify";
import { checkHealth } from "../aws/health.js";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => {
    return checkHealth(app.clients, app.configStore);
  });
};
