/**
 * Wire types shared between the Fastify backend (`apps/server`) and the React
 * frontend (`apps/web`). Keep these free of runtime dependencies other than zod.
 */

/** Normalized error envelope returned by every `/api` route on failure. */
export interface ApiErrorBody {
  error: {
    /** Machine-readable code, e.g. `LOCALSTACK_UNREACHABLE`, `NOT_IMPLEMENTED`. */
    code: string;
    /** Human-readable message, usually passed through from the AWS SDK. */
    message: string;
    /** Optional remediation hint shown under the message in the UI. */
    hint?: string;
    /** Whether retrying the same request might succeed. */
    retryable: boolean;
  };
}

export const API_ERROR_CODES = [
  "LOCALSTACK_UNREACHABLE",
  "NOT_IMPLEMENTED",
  "NOT_FOUND",
  "INVALID_PARAMETER",
  "AUTH",
  "CONFLICT",
  "UPSTREAM_ERROR",
  "BAD_REQUEST",
  "INTERNAL",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Result of `GET /api/health`. */
export interface HealthResponse {
  /** The endpoint responded to a probe request. */
  reachable: boolean;
  /** `ListClusters` succeeded — the ECS API is available at this endpoint. */
  ecsAvailable: boolean;
  /** Endpoint the server is currently pointed at. */
  endpoint: string;
  region: string;
  /** Emulator version string, when discoverable (LocalStack `_localstack/health`). */
  version?: string;
  /** e.g. `localstack`, `ministack`, `aws`, `unknown`. */
  flavor?: string;
  /** Round-trip latency of the probe, in milliseconds. */
  latencyMs?: number;
  /** Populated when `reachable` is false. */
  detail?: string;
}

/** Runtime, mutable server configuration. Credentials are never returned. */
export interface RuntimeConfigResponse {
  endpoint: string;
  region: string;
  /** `static` (test/test or explicit keys) or `profile`. */
  credentialsMode: "static" | "profile" | "default-chain";
  profile?: string;
  /** True when the endpoint host is not loopback / a private address. */
  endpointIsRemote: boolean;
  /** Set from env at boot; the UI shows a warning when a remote endpoint is used. */
  source: "env" | "runtime-override";
}

export interface UpdateRuntimeConfigRequest {
  endpoint?: string;
  region?: string;
  profile?: string | null;
  accessKeyId?: string;
  secretAccessKey?: string;
}

/** One row in the clusters list (`GET /api/clusters`). */
export interface ClusterSummary {
  name: string;
  arn: string;
  status: string;
  registeredContainerInstancesCount: number;
  runningTasksCount: number;
  pendingTasksCount: number;
  activeServicesCount: number;
  tags: Record<string, string>;
}

export interface CreateClusterRequest {
  clusterName: string;
  tags?: Record<string, string>;
}

/** Server-Sent Event payload on `GET /api/events`. */
export interface ChangeEvent {
  type:
    | "task.started"
    | "task.stopped"
    | "task.replaced-by-scheduler"
    | "service.deployment.completed"
    | "service.changed";
  cluster: string;
  /** Resource id/arn the event concerns (task id, service name). */
  resource: string;
  /** ISO timestamp. */
  ts: string;
  /** Optional free-text detail (e.g. a `stoppedReason`). */
  detail?: string;
}
