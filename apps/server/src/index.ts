import "dotenv/config";
import { buildApp } from "./app.js";

const app = await buildApp({ logger: true });
const { port } = app.serverConfig;

try {
  await app.listen({ port, host: "0.0.0.0" });
  const cfg = app.configStore.describe();
  app.log.info(`ECS Local Console API on :${port} → ${cfg.endpoint} (${cfg.region})`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
