/** Central query-key factory so invalidation stays consistent across hooks. */
export const qk = {
  health: () => ["health"] as const,
  config: () => ["config"] as const,

  clusters: () => ["clusters"] as const,
  cluster: (cluster: string) => ["clusters", cluster] as const,

  services: (cluster: string) => ["clusters", cluster, "services"] as const,
  service: (cluster: string, service: string) =>
    ["clusters", cluster, "services", service] as const,
  serviceTasks: (cluster: string, service: string) =>
    ["clusters", cluster, "services", service, "tasks"] as const,

  tasks: (cluster: string) => ["clusters", cluster, "tasks"] as const,
  task: (cluster: string, taskId: string) => ["clusters", cluster, "tasks", taskId] as const,
  allTasks: () => ["tasks"] as const,

  taskDefFamilies: () => ["task-definitions"] as const,
  taskDefFamily: (family: string) => ["task-definitions", family] as const,
  taskDef: (family: string, revision: string | number) =>
    ["task-definitions", family, String(revision)] as const,

  logGroups: (prefix?: string) => ["logs", "groups", prefix ?? ""] as const,
  logEvents: (p: {
    logGroup: string;
    logStream?: string;
    filterPattern?: string;
    start?: number;
    end?: number;
  }) =>
    [
      "logs",
      "events",
      p.logGroup,
      p.logStream ?? "*",
      p.filterPattern ?? "",
      p.start ?? 0,
      p.end ?? 0,
    ] as const,
  taskLogConfig: (cluster: string, taskId: string) =>
    ["clusters", cluster, "tasks", taskId, "log-config"] as const,
  taskEnis: (cluster: string, taskId: string) =>
    ["clusters", cluster, "tasks", taskId, "enis"] as const,
  containerInstances: (cluster: string) =>
    ["clusters", cluster, "container-instances"] as const,

  vpcs: () => ["networking", "vpcs"] as const,
  subnets: (vpcId?: string) => ["networking", "subnets", vpcId ?? "*"] as const,
  securityGroups: (vpcId?: string) => ["networking", "sg", vpcId ?? "*"] as const,
  iamRoles: (kind?: string) => ["iam", "roles", kind ?? "*"] as const,
};
