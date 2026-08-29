import { ECSClient } from "@aws-sdk/client-ecs";
import { fromIni } from "@aws-sdk/credential-providers";
import type { AwsConfig, RuntimeConfigStore } from "../config.js";

type ClientKind = "ecs";

/**
 * Lazily constructs and caches AWS SDK clients for the current runtime config.
 * The cache is cleared whenever the config store reports a change.
 */
export class ClientRegistry {
  private cache = new Map<string, unknown>();

  constructor(private readonly store: RuntimeConfigStore) {
    store.onChange(() => this.cache.clear());
  }

  private baseArgs(cfg: AwsConfig) {
    const credentials = cfg.profile
      ? fromIni({ profile: cfg.profile })
      : cfg.accessKeyId && cfg.secretAccessKey
        ? { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey }
        : undefined; // fall back to the default provider chain

    return {
      region: cfg.region,
      endpoint: cfg.endpoint || undefined,
      credentials,
      maxAttempts: 2,
      requestHandler: { requestTimeout: 8000, connectionTimeout: 3000 },
    };
  }

  private key(kind: ClientKind, cfg: AwsConfig): string {
    return [kind, cfg.endpoint, cfg.region, cfg.profile ?? "static"].join("|");
  }

  ecs(): ECSClient {
    const cfg = this.store.get();
    const key = this.key("ecs", cfg);
    let client = this.cache.get(key) as ECSClient | undefined;
    if (!client) {
      client = new ECSClient(this.baseArgs(cfg));
      this.cache.set(key, client);
    }
    return client;
  }

  clear(): void {
    this.cache.clear();
  }
}
