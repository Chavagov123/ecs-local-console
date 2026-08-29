/**
 * One-sentence plain-language explanations of ECS concepts, surfaced as small
 * info tooltips throughout the UI. Deliberately terse — this is a console with
 * light annotations, not a tutorial.
 */
export const ANNOTATIONS = {
  // Task lifecycle
  PROVISIONING:
    "ECS is allocating resources for the task (e.g. attaching an elastic network interface).",
  PENDING: "The task is waiting for the container agent to pull images and start containers.",
  ACTIVATING:
    "Containers have started; ECS is completing setup like service-discovery registration and load-balancer target registration.",
  RUNNING: "All essential containers are up and the task is in service.",
  DEACTIVATING:
    "ECS is de-registering the task from load balancers and service discovery before stopping it.",
  STOPPING: "ECS has issued a stop to the task's containers.",
  DEPROVISIONING: "ECS is releasing the resources that were allocated during provisioning.",
  STOPPED: "The task has exited. Check 'stopped reason' and each container's exit code.",

  // Service
  SERVICE_DRAINING:
    "The service is being deleted or replaced; its tasks are being drained from load balancers.",
  DESIRED_COUNT:
    "The number of task copies you want running. The ECS scheduler continuously works to match it.",
  SCHEDULER_REPLACED_TASK:
    "The service scheduler started a replacement task — usually because one stopped, failed a health check, or a new deployment rolled out.",

  // Deployments
  DEPLOYMENT_IN_PROGRESS:
    "A new task-definition revision is rolling out; old and new tasks run side by side until the new ones are healthy.",
  DEPLOYMENT_CIRCUIT_BREAKER:
    "If enabled, ECS automatically rolls back a deployment that fails to reach a steady state.",

  // Networking
  NETWORK_MODE_AWSVPC:
    "Each task gets its own elastic network interface and private IP — like a mini EC2 instance.",
  NETWORK_MODE_BRIDGE:
    "Containers share the host's Docker bridge network; host ports are mapped to container ports.",

  // Container instances
  NO_CONTAINER_INSTANCES:
    "Fargate / LocalStack tasks don't run on registered EC2 container instances, so this list is normally empty.",
} as const;

export type AnnotationKey = keyof typeof ANNOTATIONS;

export function annotation(key: AnnotationKey): string {
  return ANNOTATIONS[key];
}
