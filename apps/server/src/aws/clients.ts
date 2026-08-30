import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";
import { EC2Client } from "@aws-sdk/client-ec2";
import { ECSClient } from "@aws-sdk/client-ecs";
import { IAMClient } from "@aws-sdk/client-iam";
import { fromIni } from "@aws-sdk/credential-providers";
import type { AwsConfig, RuntimeConfigStore } from "../config.js";

type ClientKind = "ecs" | "ec2" | "iam" | "logs";

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

  private get<T>(kind: ClientKind, make: (args: ReturnType<ClientRegistry["baseArgs"]>) => T): T {
    const cfg = this.store.get();
    const key = this.key(kind, cfg);
    let client = this.cache.get(key) as T | undefined;
    if (!client) {
      client = make(this.baseArgs(cfg));
      this.cache.set(key, client);
    }
    return client;
  }

  ecs(): ECSClient {
    return this.get("ecs", (a) => new ECSClient(a));
  }

  ec2(): EC2Client {
    return this.get("ec2", (a) => new EC2Client(a));
  }

  iam(): IAMClient {
    return this.get("iam", (a) => new IAMClient(a));
  }

  logs(): CloudWatchLogsClient {
    return this.get("logs", (a) => new CloudWatchLogsClient(a));
  }

  clear(): void {
    this.cache.clear();
  }
}
