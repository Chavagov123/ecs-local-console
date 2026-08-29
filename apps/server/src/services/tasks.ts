import {
  DescribeTasksCommand,
  ListTasksCommand,
  RunTaskCommand,
  StopTaskCommand,
  type DesiredStatus,
  type RunTaskCommandInput,
  type Task,
} from "@aws-sdk/client-ecs";
import type {
  RunTaskResult,
  TaskContainer,
  TaskDetail,
  TaskSummary,
} from "@ecs-local-console/shared";
import type { ClientRegistry } from "../aws/clients.js";
import type { TtlCache } from "./cache.js";
import { chunk } from "./ecs.js";

export function taskIdFromArn(arn: string | undefined): string {
  if (!arn) return "";
  return arn.slice(arn.lastIndexOf("/") + 1);
}

function tdName(arn: string | undefined): string {
  if (!arn) return "";
  return arn.includes("task-definition/") ? arn.slice(arn.indexOf("task-definition/") + 16) : arn;
}

export function toTaskSummary(t: Task): TaskSummary {
  const last = t.lastStatus ?? "UNKNOWN";
  const desired = t.desiredStatus ?? last;
  return {
    taskId: taskIdFromArn(t.taskArn),
    arn: t.taskArn ?? "",
    clusterArn: t.clusterArn ?? "",
    taskDefinition: tdName(t.taskDefinitionArn),
    lastStatus: last,
    desiredStatus: desired,
    healthStatus: t.healthStatus,
    launchType: t.launchType,
    cpu: t.cpu,
    memory: t.memory,
    startedBy: t.startedBy,
    group: t.group,
    createdAt: t.createdAt?.toISOString(),
    startedAt: t.startedAt?.toISOString(),
    stoppedAt: t.stoppedAt?.toISOString(),
    stoppedReason: t.stoppedReason,
    transitioning: last.toUpperCase() !== desired.toUpperCase(),
  };
}

function toContainer(c: NonNullable<Task["containers"]>[number]): TaskContainer {
  return {
    name: c.name ?? "",
    image: c.image,
    lastStatus: c.lastStatus,
    healthStatus: c.healthStatus,
    exitCode: c.exitCode,
    reason: c.reason,
    networkBindings: (c.networkBindings ?? []).map((n) => ({
      bindIP: n.bindIP,
      containerPort: n.containerPort,
      hostPort: n.hostPort,
      protocol: n.protocol,
    })),
    networkInterfaces: (c.networkInterfaces ?? []).map((n) => ({
      privateIpv4Address: n.privateIpv4Address,
      attachmentId: n.attachmentId,
    })),
  };
}

export function toTaskDetail(t: Task): TaskDetail {
  const tags: Record<string, string> = {};
  for (const tag of t.tags ?? []) if (tag.key) tags[tag.key] = tag.value ?? "";
  return {
    ...toTaskSummary(t),
    connectivity: t.connectivity,
    platformVersion: t.platformVersion,
    containers: (t.containers ?? []).map(toContainer),
    attachments: (t.attachments ?? []).map((a) => {
      const details: Record<string, string> = {};
      for (const kv of a.details ?? []) if (kv.name) details[kv.name] = kv.value ?? "";
      return { id: a.id, type: a.type, status: a.status, details };
    }),
    overrides: t.overrides,
    tags,
  };
}

export interface ListTasksFilters {
  serviceName?: string;
  family?: string;
  startedBy?: string;
  desiredStatus?: DesiredStatus;
  launchType?: string;
}

export async function listTasks(
  clients: ClientRegistry,
  cache: TtlCache,
  cluster: string,
  filters: ListTasksFilters = {},
): Promise<TaskSummary[]> {
  const key = `tasks:list:${cluster}:${JSON.stringify(filters)}`;
  return cache.wrap(key, async () => {
    const ecs = clients.ecs();
    const arns: string[] = [];
    let nextToken: string | undefined;
    do {
      const page = await ecs.send(
        new ListTasksCommand({
          cluster,
          serviceName: filters.serviceName,
          family: filters.family,
          startedBy: filters.startedBy,
          desiredStatus: filters.desiredStatus,
          launchType: filters.launchType as ListTasksCommand["input"]["launchType"],
          nextToken,
        }),
      );
      arns.push(...(page.taskArns ?? []));
      nextToken = page.nextToken;
    } while (nextToken);

    if (arns.length === 0) return [];
    const out: TaskSummary[] = [];
    for (const group of chunk(arns, 100)) {
      const desc = await ecs.send(new DescribeTasksCommand({ cluster, tasks: group }));
      out.push(...(desc.tasks ?? []).map(toTaskSummary));
    }
    return out.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  });
}

export async function describeTask(
  clients: ClientRegistry,
  cache: TtlCache,
  cluster: string,
  taskId: string,
): Promise<TaskDetail> {
  return cache.wrap(`tasks:detail:${cluster}:${taskId}`, async () => {
    const res = await clients.ecs().send(
      new DescribeTasksCommand({ cluster, tasks: [taskId], include: ["TAGS"] }),
    );
    const t = res.tasks?.[0];
    if (!t) {
      throw Object.assign(new Error(`Task ${taskId} not found in ${cluster}`), {
        name: "TaskNotFoundException",
      });
    }
    return toTaskDetail(t);
  });
}

export async function runTask(
  clients: ClientRegistry,
  cache: TtlCache,
  cluster: string,
  input: Omit<RunTaskCommandInput, "cluster">,
): Promise<RunTaskResult> {
  const res = await clients.ecs().send(new RunTaskCommand({ ...input, cluster }));
  cache.invalidate(`tasks:`);
  cache.invalidate(`clusters:`);

  const tasks = (res.tasks ?? []).map(toTaskSummary);
  const failures = (res.failures ?? []).map((f) => ({
    arn: f.arn,
    reason: f.reason ?? "unknown",
    detail: f.detail,
  }));

  // Nothing started at all — this is an error, not a partial success.
  if (tasks.length === 0) {
    const reason = failures[0]?.reason ?? "ECS did not start any task";
    throw Object.assign(new Error(reason), { name: "InvalidParameterException" });
  }
  // Otherwise return both: ECS routinely places some copies and rejects others
  // (e.g. RESOURCE:MEMORY), and dropping the failures would hide that.
  return { tasks, failures };
}

export async function stopTask(
  clients: ClientRegistry,
  cache: TtlCache,
  cluster: string,
  taskId: string,
  reason: string | undefined,
): Promise<TaskSummary> {
  const res = await clients
    .ecs()
    .send(
      new StopTaskCommand({
        cluster,
        task: taskId,
        reason: reason ?? "Stopped from ECS Local Console",
      }),
    );
  cache.invalidate(`tasks:`);
  cache.invalidate(`clusters:`);
  if (!res.task) {
    // The call was accepted but nothing was echoed back — don't report a
    // successful stop of a task we can't describe.
    throw Object.assign(new Error(`Task ${taskId} was not returned by StopTask`), {
      name: "TaskNotFoundException",
    });
  }
  return toTaskSummary(res.task);
}
