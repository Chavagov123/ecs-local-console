import { isIP } from "node:net";
import type { RuntimeConfigResponse } from "@ecs-local-console/shared";

export interface ServerConfig {
  port: number;
  /** Absolute path to the built web app, served in production. Empty in dev. */
  webDir: string;
  /** Extra CORS origins allowed in addition to same-origin (dev only). */
  webOrigins: string[];
}

export interface AwsConfig {
  endpoint: string;
  region: string;
  /** Static credentials, or undefined to fall back to profile / default chain. */
  accessKeyId?: string;
  secretAccessKey?: string;
  profile?: string;
}

function parseOrigins(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: Number(env.PORT ?? 4570),
    webDir: env.WEB_DIR ?? "",
    webOrigins: parseOrigins(env.WEB_ORIGIN),
  };
}

function envAwsConfig(env: NodeJS.ProcessEnv): AwsConfig {
  return {
    endpoint: env.AWS_ENDPOINT_URL || "http://localhost:4566",
    region: env.AWS_REGION || env.AWS_DEFAULT_REGION || "us-east-1",
    accessKeyId: env.AWS_ACCESS_KEY_ID || (env.AWS_PROFILE ? undefined : "test"),
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY || (env.AWS_PROFILE ? undefined : "test"),
    profile: env.AWS_PROFILE || undefined,
  };
}

/** Host is loopback or an RFC1918 / link-local address. */
export function endpointIsRemote(endpoint: string): boolean {
  let host: string;
  try {
    host = new URL(endpoint).hostname;
  } catch {
    return false;
  }
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (host === "host.docker.internal" || host === "localstack") return false;
  if (isIP(host) === 0) return true; // a DNS name we can't classify -> treat as remote
  if (host === "127.0.0.1" || host === "::1") return false;
  if (host.startsWith("10.") || host.startsWith("192.168.")) return false;
  if (host.startsWith("169.254.")) return false;
  const m = /^172\.(\d+)\./.exec(host);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return false;
  return true;
}

/**
 * Holds the mutable AWS configuration. Starts from env; `PUT /api/config` can
 * override it at runtime (in memory only — never persisted).
 */
export class RuntimeConfigStore {
  private current: AwsConfig;
  private overridden = false;
  private readonly listeners = new Set<() => void>();

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.current = envAwsConfig(env);
  }

  get(): AwsConfig {
    return this.current;
  }

  /** Register a callback fired whenever the config changes (used to bust client caches). */
  onChange(fn: () => void): void {
    this.listeners.add(fn);
  }

  update(patch: {
    endpoint?: string;
    region?: string;
    profile?: string | null;
    accessKeyId?: string;
    secretAccessKey?: string;
  }): void {
    const next: AwsConfig = { ...this.current };
    if (patch.endpoint !== undefined) next.endpoint = patch.endpoint;
    if (patch.region !== undefined) next.region = patch.region;
    if (patch.profile !== undefined) {
      next.profile = patch.profile ?? undefined;
      if (next.profile) {
        next.accessKeyId = undefined;
        next.secretAccessKey = undefined;
      }
    }
    if (patch.accessKeyId !== undefined) {
      next.accessKeyId = patch.accessKeyId;
      next.profile = undefined;
    }
    if (patch.secretAccessKey !== undefined) {
      next.secretAccessKey = patch.secretAccessKey;
      next.profile = undefined;
    }
    this.current = next;
    this.overridden = true;
    for (const fn of this.listeners) fn();
  }

  describe(): RuntimeConfigResponse {
    const c = this.current;
    const credentialsMode: RuntimeConfigResponse["credentialsMode"] = c.profile
      ? "profile"
      : c.accessKeyId
        ? "static"
        : "default-chain";
    return {
      endpoint: c.endpoint,
      region: c.region,
      credentialsMode,
      profile: c.profile,
      endpointIsRemote: endpointIsRemote(c.endpoint),
      source: this.overridden ? "runtime-override" : "env",
    };
  }
}
