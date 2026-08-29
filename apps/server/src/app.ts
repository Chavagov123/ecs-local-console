import { existsSync } from "node:fs";
import { join } from "node:path";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import { ClientRegistry } from "./aws/clients.js";
import { ApiError } from "./aws/errors.js";
import { loadServerConfig, RuntimeConfigStore, type ServerConfig } from "./config.js";
import { clusterRoutes } from "./routes/clusters.js";
import { configRoutes } from "./routes/config.js";
import { healthRoutes } from "./routes/health.js";
import { serviceRoutes } from "./routes/services.js";
import { taskDefinitionRoutes } from "./routes/task-definitions.js";
import { taskRoutes } from "./routes/tasks.js";
import { TtlCache } from "./services/cache.js";

declare module "fastify" {
  interface FastifyInstance {
    clients: ClientRegistry;
    cache: TtlCache;
    configStore: RuntimeConfigStore;
    serverConfig: ServerConfig;
  }
}

export interface BuildAppOptions {
  env?: NodeJS.ProcessEnv;
  logger?: boolean;
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const env = opts.env ?? process.env;
  const serverConfig = loadServerConfig(env);
  const configStore = new RuntimeConfigStore(env);
  const clients = new ClientRegistry(configStore);
  const cache = new TtlCache(1500);
  configStore.onChange(() => cache.invalidate());

  const app = Fastify({
    logger: opts.logger ?? false,
    trustProxy: true,
  });

  app.decorate("clients", clients);
  app.decorate("cache", cache);
  app.decorate("configStore", configStore);
  app.decorate("serverConfig", serverConfig);

  await app.register(sensible);

  if (serverConfig.webOrigins.length > 0) {
    await app.register(cors, { origin: serverConfig.webOrigins, credentials: true });
  }

  app.setErrorHandler((err: Error & { validation?: unknown }, _req, reply) => {
    if (err instanceof ApiError) {
      return reply.code(err.status).send(err.toBody());
    }
    if (err.validation) {
      return reply
        .code(400)
        .send({ error: { code: "BAD_REQUEST", message: err.message, retryable: false } });
    }
    app.log.error(err);
    return reply
      .code(500)
      .send({ error: { code: "INTERNAL", message: err.message, retryable: false } });
  });

  await app.register(
    async (api) => {
      await api.register(healthRoutes);
      await api.register(configRoutes);
      await api.register(clusterRoutes);
      await api.register(serviceRoutes);
      await api.register(taskRoutes);
      await api.register(taskDefinitionRoutes);
    },
    { prefix: "/api" },
  );

  // Serve the built web app in production (WEB_DIR), with SPA fallback.
  const webDir = serverConfig.webDir || join(process.cwd(), "public");
  if (existsSync(join(webDir, "index.html"))) {
    await app.register(fastifyStatic, { root: webDir, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) {
        return reply
          .code(404)
          .send({ error: { code: "NOT_FOUND", message: "No such route", retryable: false } });
      }
      return reply.sendFile("index.html");
    });
  }

  return app;
}
