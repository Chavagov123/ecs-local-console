/**
 * CloudWatch Logs reads for the log viewer, plus resolving a task's per-container
 * logging config from its task definition.
 */
import {
  DescribeLogGroupsCommand,
  FilterLogEventsCommand,
  GetLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import {
  DescribeTaskDefinitionCommand,
  DescribeTasksCommand,
} from "@aws-sdk/client-ecs";
import type {
  ContainerLogConfig,
  LogEvent,
  LogGroup,
  LogPage,
  TaskLogConfig,
} from "@ecs-local-console/shared";
import type { ClientRegistry } from "../aws/clients.js";
import type { TtlCache } from "./cache.js";

const GROUPS_TTL = 5_000;

export async function listLogGroups(
  clients: ClientRegistry,
  cache: TtlCache,
  opts: { prefix?: string; nextToken?: string; limit?: number } = {},
): Promise<{ groups: LogGroup[]; nextToken?: string }> {
  return cache.wrap(
    `logs:groups:${opts.prefix ?? ""}:${opts.nextToken ?? ""}:${opts.limit ?? ""}`,
    async () => {
      const res = await clients.logs().send(
        new DescribeLogGroupsCommand({
          logGroupNamePrefix: opts.prefix,
          nextToken: opts.nextToken,
          limit: opts.limit ?? 50,
        }),
      );
      const groups: LogGroup[] = (res.logGroups ?? []).map((g) => ({
        name: g.logGroupName ?? "",
        arn: g.arn,
        storedBytes: g.storedBytes,
        retentionInDays: g.retentionInDays,
        createdAt: g.creationTime ? new Date(g.creationTime).toISOString() : undefined,
      }));
      return { groups, nextToken: res.nextToken };
    },
    GROUPS_TTL,
  );
}

export interface LogEventQuery {
  logGroup: string;
  logStream?: string;
  start?: number;
  end?: number;
  filterPattern?: string;
  nextToken?: string;
  limit?: number;
}

/** Not cached — logs move constantly and the UI drives polling itself. */
export async function getLogEvents(
  clients: ClientRegistry,
  q: LogEventQuery,
): Promise<LogPage> {
  const logs = clients.logs();
  const limit = Math.min(q.limit ?? 200, 1000);

  // Single known stream, no search term → GetLogEvents (has forward + backward cursors).
  if (q.logStream && !q.filterPattern) {
    const res = await logs.send(
      new GetLogEventsCommand({
        logGroupName: q.logGroup,
        logStreamName: q.logStream,
        startTime: q.start,
        endTime: q.end,
        nextToken: q.nextToken,
        limit,
        startFromHead: false,
      }),
    );
    const events: LogEvent[] = (res.events ?? []).map((e, i) => ({
      timestamp: e.timestamp ?? 0,
      message: e.message ?? "",
      ingestionTime: e.ingestionTime,
      logStreamName: q.logStream,
      eventId: `${e.timestamp ?? 0}:${i}`,
    }));
    return {
      events,
      nextBackwardToken: res.nextBackwardToken,
      nextForwardToken: res.nextForwardToken,
    };
  }

  // Multi-stream or filtered → FilterLogEvents (forward-only pagination).
  const res = await logs.send(
    new FilterLogEventsCommand({
      logGroupName: q.logGroup,
      logStreamNames: q.logStream ? [q.logStream] : undefined,
      startTime: q.start,
      endTime: q.end,
      filterPattern: q.filterPattern,
      nextToken: q.nextToken,
      limit,
    }),
  );
  const events: LogEvent[] = (res.events ?? []).map((e, i) => ({
    timestamp: e.timestamp ?? 0,
    message: e.message ?? "",
    ingestionTime: e.ingestionTime,
    logStreamName: e.logStreamName,
    eventId: e.eventId ?? `${e.timestamp ?? 0}:${i}`,
  }));
  return { events, nextBackwardToken: res.nextToken };
}

function optionOf(
  logConfiguration: { options?: Record<string, string> } | undefined,
  key: string,
): string | undefined {
  return logConfiguration?.options?.[key];
}

export async function taskLogConfig(
  clients: ClientRegistry,
  cache: TtlCache,
  cluster: string,
  taskId: string,
): Promise<TaskLogConfig> {
  return cache.wrap(
    `logs:taskcfg:${cluster}:${taskId}`,
    async () => {
      const ecs = clients.ecs();
      const desc = await ecs.send(new DescribeTasksCommand({ cluster, tasks: [taskId] }));
      const task = desc.tasks?.[0];
      if (!task) {
        throw Object.assign(new Error(`Task ${taskId} not found in ${cluster}`), {
          name: "TaskNotFoundException",
        });
      }
      const tdRes = await ecs.send(
        new DescribeTaskDefinitionCommand({ taskDefinition: task.taskDefinitionArn ?? "" }),
      );
      const shortId = taskId.slice(taskId.lastIndexOf("/") + 1);
      const containers: ContainerLogConfig[] = (tdRes.taskDefinition?.containerDefinitions ?? []).map(
        (c) => {
          const driver = c.logConfiguration?.logDriver ?? "none";
          if (driver !== "awslogs") {
            return {
              container: c.name ?? "",
              logDriver: driver,
              hint:
                driver === "none"
                  ? "No log driver configured on this container."
                  : `Uses the '${driver}' driver — logs aren't in CloudWatch.`,
            };
          }
          const group = optionOf(c.logConfiguration, "awslogs-group");
          const prefix = optionOf(c.logConfiguration, "awslogs-stream-prefix");
          return {
            container: c.name ?? "",
            logDriver: driver,
            awslogsGroup: group,
            awslogsStreamPrefix: prefix,
            awslogsRegion: optionOf(c.logConfiguration, "awslogs-region"),
            computedStream: prefix ? `${prefix}/${c.name}/${shortId}` : undefined,
          };
        },
      );
      return { taskId, containers };
    },
    3_000,
  );
}
