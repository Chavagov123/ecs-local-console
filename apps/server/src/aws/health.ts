import { ListClustersCommand } from "@aws-sdk/client-ecs";
import type { HealthResponse } from "@ecs-local-console/shared";
import type { RuntimeConfigStore } from "../config.js";
import type { ClientRegistry } from "./clients.js";
import { normalizeAwsError } from "./errors.js";

/** Probe LocalStack's own health endpoint for a version/flavor string. */
async function probeFlavor(
  endpoint: string,
): Promise<{ version?: string; flavor?: string } | undefined> {
  try {
    const url = new URL("/_localstack/health", endpoint);
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return { flavor: "unknown" };
    const body = (await res.json()) as { version?: string; edition?: string };
    return { version: body.version, flavor: "localstack" };
  } catch {
    return undefined;
  }
}

export async function checkHealth(
  clients: ClientRegistry,
  store: RuntimeConfigStore,
): Promise<HealthResponse> {
  const cfg = store.get();
  const started = Date.now();
  let reachable = false;
  let ecsAvailable = false;
  let detail: string | undefined;

  try {
    await clients.ecs().send(new ListClustersCommand({ maxResults: 1 }));
    reachable = true;
    ecsAvailable = true;
  } catch (err) {
    const normalized = normalizeAwsError(err, cfg.endpoint);
    if (normalized.code === "LOCALSTACK_UNREACHABLE") {
      detail = normalized.message;
    } else {
      // Got an HTTP response, just not a happy one — the endpoint is up.
      reachable = true;
      detail = normalized.message;
    }
  }

  const flavor = reachable ? await probeFlavor(cfg.endpoint) : undefined;

  return {
    reachable,
    ecsAvailable,
    endpoint: cfg.endpoint,
    region: cfg.region,
    version: flavor?.version,
    flavor: flavor?.flavor ?? (reachable ? "unknown" : undefined),
    latencyMs: Date.now() - started,
    detail,
  };
}
