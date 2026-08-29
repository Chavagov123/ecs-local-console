/** ECS lifecycle vocabularies and the semantic bucket each value maps to. */

export type StatusTone = "success" | "warning" | "danger" | "muted" | "info";

/** Task `lastStatus` / `desiredStatus` progression. */
export const TASK_STATUS_TONE: Record<string, StatusTone> = {
  PROVISIONING: "warning",
  PENDING: "warning",
  ACTIVATING: "warning",
  RUNNING: "success",
  DEACTIVATING: "warning",
  STOPPING: "warning",
  DEPROVISIONING: "warning",
  STOPPED: "muted",
  DELETED: "muted",
};

/** Service `status`. */
export const SERVICE_STATUS_TONE: Record<string, StatusTone> = {
  ACTIVE: "success",
  DRAINING: "warning",
  INACTIVE: "muted",
};

/** Deployment `rolloutState`. */
export const DEPLOYMENT_STATUS_TONE: Record<string, StatusTone> = {
  COMPLETED: "success",
  IN_PROGRESS: "warning",
  FAILED: "danger",
};

/** Container instance `status`. */
export const CONTAINER_INSTANCE_STATUS_TONE: Record<string, StatusTone> = {
  ACTIVE: "success",
  DRAINING: "warning",
  REGISTERING: "warning",
  DEREGISTERING: "warning",
  REGISTRATION_FAILED: "danger",
  INACTIVE: "muted",
};

export type StatusKind = "task" | "service" | "deployment" | "instance";

const TONE_BY_KIND: Record<StatusKind, Record<string, StatusTone>> = {
  task: TASK_STATUS_TONE,
  service: SERVICE_STATUS_TONE,
  deployment: DEPLOYMENT_STATUS_TONE,
  instance: CONTAINER_INSTANCE_STATUS_TONE,
};

/** Resolve a status string to a tone, tolerant of case and unknown values. */
export function statusTone(status: string | undefined | null, kind: StatusKind): StatusTone {
  if (!status) return "muted";
  const table = TONE_BY_KIND[kind];
  return table[status.toUpperCase()] ?? "muted";
}

/** True while a task is between two states and expected to move again soon. */
export function taskIsTransitioning(lastStatus?: string, desiredStatus?: string): boolean {
  if (!lastStatus || !desiredStatus) return false;
  return lastStatus.toUpperCase() !== desiredStatus.toUpperCase();
}
