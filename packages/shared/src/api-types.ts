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
  reachable: boolean;
  ecsAvailable: boolean;
  endpoint: string;
  region: string;
  version?: string;
  flavor?: string;
  latencyMs?: number;
  detail?: string;
}

/** Runtime, mutable server configuration. Credentials are never returned. */
export interface RuntimeConfigResponse {
  endpoint: string;
  region: string;
  credentialsMode: "static" | "profile" | "default-chain";
  profile?: string;
  endpointIsRemote: boolean;
  source: "env" | "runtime-override";
}

export interface UpdateRuntimeConfigRequest {
  endpoint?: string;
  region?: string;
  profile?: string | null;
  accessKeyId?: string;
  secretAccessKey?: string;
}

// ---------------------------------------------------------------------------
// Clusters
// ---------------------------------------------------------------------------

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

export interface ClusterDetail extends ClusterSummary {
  statistics: Record<string, string>;
  settings: Record<string, string>;
  capacityProviders: string[];
  defaultCapacityProviderStrategy: {
    capacityProvider: string;
    weight?: number;
    base?: number;
  }[];
}

export interface CreateClusterRequest {
  clusterName: string;
  tags?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

export interface ServiceDeployment {
  id: string;
  status: string;
  taskDefinition: string;
  desiredCount: number;
  pendingCount: number;
  runningCount: number;
  failedTasks: number;
  rolloutState?: string;
  rolloutStateReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServiceEvent {
  id: string;
  createdAt?: string;
  message: string;
}

export interface LoadBalancerRef {
  targetGroupArn?: string;
  loadBalancerName?: string;
  containerName?: string;
  containerPort?: number;
}

export interface ServiceSummary {
  name: string;
  arn: string;
  clusterArn: string;
  status: string;
  taskDefinition: string;
  desiredCount: number;
  runningCount: number;
  pendingCount: number;
  launchType?: string;
  schedulingStrategy?: string;
  createdAt?: string;
  /** True when a deployment is not yet COMPLETED or counts don't match desired. */
  deploymentInProgress: boolean;
}

export interface ServiceDetail extends ServiceSummary {
  roleArn?: string;
  propagateTags?: string;
  enableExecuteCommand?: boolean;
  deploymentConfiguration?: {
    minimumHealthyPercent?: number;
    maximumPercent?: number;
    deploymentCircuitBreaker?: { enable: boolean; rollback: boolean };
  };
  networkConfiguration?: NetworkConfiguration;
  loadBalancers: LoadBalancerRef[];
  serviceRegistries: { registryArn?: string; containerName?: string; containerPort?: number }[];
  deployments: ServiceDeployment[];
  events: ServiceEvent[];
  tags: Record<string, string>;
}

export interface NetworkConfiguration {
  awsvpcConfiguration?: {
    subnets: string[];
    securityGroups: string[];
    assignPublicIp?: string;
  };
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export interface TaskContainer {
  name: string;
  image?: string;
  lastStatus?: string;
  healthStatus?: string;
  exitCode?: number;
  reason?: string;
  networkBindings: {
    bindIP?: string;
    containerPort?: number;
    hostPort?: number;
    protocol?: string;
  }[];
  networkInterfaces: { privateIpv4Address?: string; attachmentId?: string }[];
  logConfiguration?: {
    logDriver: string;
    options?: Record<string, string>;
  };
}

export interface TaskSummary {
  taskId: string;
  arn: string;
  clusterArn: string;
  taskDefinition: string;
  lastStatus: string;
  desiredStatus: string;
  healthStatus?: string;
  launchType?: string;
  cpu?: string;
  memory?: string;
  startedBy?: string;
  group?: string;
  createdAt?: string;
  startedAt?: string;
  stoppedAt?: string;
  stoppedReason?: string;
  /** True while lastStatus !== desiredStatus. */
  transitioning: boolean;
}

/** One entry of ECS's `failures[]` — a placement the scheduler rejected. */
export interface EcsFailure {
  arn?: string;
  reason: string;
  detail?: string;
}

/**
 * `RunTask` is partially fallible: ECS can place some copies and reject others,
 * so both halves are reported rather than only the tasks that started.
 */
export interface RunTaskResult {
  tasks: TaskSummary[];
  failures: EcsFailure[];
}

export interface TaskDetail extends TaskSummary {
  connectivity?: string;
  platformVersion?: string;
  containers: TaskContainer[];
  attachments: {
    id?: string;
    type?: string;
    status?: string;
    details: Record<string, string>;
  }[];
  overrides?: unknown;
  tags: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Task definitions
// ---------------------------------------------------------------------------

export interface TaskDefFamily {
  family: string;
  latestRevision?: number;
  activeRevisions: number;
  status: string;
}

export interface TaskDefRevisionSummary {
  family: string;
  revision: number;
  arn: string;
  status: string;
  cpu?: string;
  memory?: string;
  networkMode?: string;
  requiresCompatibilities: string[];
  containerNames: string[];
  registeredAt?: string;
}

export interface TaskDefDetail extends TaskDefRevisionSummary {
  /** The raw RegisterTaskDefinition-shaped JSON, for the editor and diff views. */
  json: Record<string, unknown>;
  tags: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Networking / IAM (form pickers)
// ---------------------------------------------------------------------------

export interface Vpc {
  vpcId: string;
  cidrBlock?: string;
  isDefault: boolean;
  name?: string;
}

export interface Subnet {
  subnetId: string;
  vpcId?: string;
  cidrBlock?: string;
  availabilityZone?: string;
  mapPublicIpOnLaunch: boolean;
  name?: string;
}

export interface SecurityGroup {
  groupId: string;
  groupName?: string;
  vpcId?: string;
  description?: string;
}

export interface IamRole {
  roleName: string;
  arn: string;
  path?: string;
  createDate?: string;
  /** Best-effort classification from the trust policy / name. */
  kind: "task" | "execution" | "other";
}

// ---------------------------------------------------------------------------
// Events (SSE)
// ---------------------------------------------------------------------------

export interface ChangeEvent {
  type:
    | "task.started"
    | "task.stopped"
    | "task.replaced-by-scheduler"
    | "service.deployment.completed"
    | "service.changed";
  cluster: string;
  resource: string;
  ts: string;
  detail?: string;
}
