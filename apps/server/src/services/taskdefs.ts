import {
  DescribeTaskDefinitionCommand,
  ListTaskDefinitionFamiliesCommand,
  ListTaskDefinitionsCommand,
  RegisterTaskDefinitionCommand,
  DeregisterTaskDefinitionCommand,
  type TaskDefinition,
} from "@aws-sdk/client-ecs";
import type {
  TaskDefDetail,
  TaskDefFamily,
  TaskDefRevisionSummary,
} from "@ecs-local-console/shared";
import type { ClientRegistry } from "../aws/clients.js";
import { chunk } from "./ecs.js";
import type { TtlCache } from "./cache.js";

/** Task-definition listings change rarely; a longer TTL keeps the N+1 fan-out off the hot path. */
const TASKDEF_LIST_TTL = 30_000;
/** How many revisions to hydrate with a Describe on the list view (newest first). */
const REVISION_DETAIL_CAP = 20;

function revFromArn(arn: string | undefined): number {
  if (!arn) return 0;
  const m = /:(\d+)$/.exec(arn);
  return m ? Number(m[1]) : 0;
}

function familyFromArn(arn: string | undefined): string {
  if (!arn) return "";
  const tail = arn.slice(arn.indexOf("task-definition/") + 16);
  return tail.split(":")[0] ?? tail;
}

export function toRevisionSummary(td: TaskDefinition): TaskDefRevisionSummary {
  return {
    family: td.family ?? familyFromArn(td.taskDefinitionArn),
    revision: td.revision ?? revFromArn(td.taskDefinitionArn),
    arn: td.taskDefinitionArn ?? "",
    status: td.status ?? "ACTIVE",
    cpu: td.cpu,
    memory: td.memory,
    networkMode: td.networkMode,
    requiresCompatibilities: td.requiresCompatibilities ?? [],
    containerNames: (td.containerDefinitions ?? []).map((c) => c.name ?? "").filter(Boolean),
    registeredAt: td.registeredAt?.toISOString(),
  };
}

export async function listFamilies(
  clients: ClientRegistry,
  cache: TtlCache,
): Promise<TaskDefFamily[]> {
  return cache.wrap(
    "taskdefs:families",
    async () => {
      const ecs = clients.ecs();
      const families: string[] = [];
      let nextToken: string | undefined;
      do {
        const page = await ecs.send(
          new ListTaskDefinitionFamiliesCommand({ status: "ALL", nextToken }),
        );
        families.push(...(page.families ?? []));
        nextToken = page.nextToken;
      } while (nextToken);

      // One ListTaskDefinitions per family for latest revision + active count — still N+1,
      // but parallelised (bounded) and behind a 30s TTL so tab-fanout can't amplify it.
      const out: TaskDefFamily[] = [];
      for (const group of chunk(families.sort(), 10)) {
        const results = await Promise.all(
          group.map((family) =>
            ecs
              .send(
                new ListTaskDefinitionsCommand({
                  familyPrefix: family,
                  status: "ACTIVE",
                  sort: "DESC",
                }),
              )
              .then((active) => ({ family, arns: active.taskDefinitionArns ?? [] })),
          ),
        );
        for (const { family, arns } of results) {
          out.push({
            family,
            latestRevision: arns[0] ? revFromArn(arns[0]) : undefined,
            activeRevisions: arns.length,
            status: arns.length > 0 ? "ACTIVE" : "INACTIVE",
          });
        }
      }
      return out;
    },
    TASKDEF_LIST_TTL,
  );
}

export async function listRevisions(
  clients: ClientRegistry,
  cache: TtlCache,
  family: string,
): Promise<TaskDefRevisionSummary[]> {
  return cache.wrap(
    `taskdefs:revisions:${family}`,
    async () => {
      const ecs = clients.ecs();
      const arns: string[] = [];
      let nextToken: string | undefined;
      for (const status of ["ACTIVE", "INACTIVE"] as const) {
        do {
          const page = await ecs.send(
            new ListTaskDefinitionsCommand({ familyPrefix: family, status, sort: "DESC", nextToken }),
          );
          arns.push(...(page.taskDefinitionArns ?? []));
          nextToken = page.nextToken;
        } while (nextToken);
      }
      // Sorted DESC per bucket; take the newest N and hydrate them in parallel.
      const byRevisionDesc = arns.sort((a, b) => revFromArn(b) - revFromArn(a));
      const out: TaskDefRevisionSummary[] = [];
      for (const group of chunk(byRevisionDesc.slice(0, REVISION_DETAIL_CAP), 10)) {
        const described = await Promise.all(
          group.map((arn) =>
            ecs.send(new DescribeTaskDefinitionCommand({ taskDefinition: arn })),
          ),
        );
        for (const d of described) if (d.taskDefinition) out.push(toRevisionSummary(d.taskDefinition));
      }
      return out;
    },
    TASKDEF_LIST_TTL,
  );
}

export async function describeTaskDef(
  clients: ClientRegistry,
  cache: TtlCache,
  ref: string,
): Promise<TaskDefDetail> {
  return cache.wrap(`taskdefs:detail:${ref}`, async () => {
    const res = await clients
      .ecs()
      .send(new DescribeTaskDefinitionCommand({ taskDefinition: ref, include: ["TAGS"] }));
    const td = res.taskDefinition;
    if (!td) {
      throw Object.assign(new Error(`Task definition ${ref} not found`), {
        name: "ClientException",
      });
    }
    const tags: Record<string, string> = {};
    for (const t of res.tags ?? []) if (t.key) tags[t.key] = t.value ?? "";
    return { ...toRevisionSummary(td), json: td as Record<string, unknown>, tags };
  });
}

export async function registerTaskDef(
  clients: ClientRegistry,
  cache: TtlCache,
  input: Record<string, unknown>,
): Promise<TaskDefDetail> {
  const res = await clients
    .ecs()
    .send(
      new RegisterTaskDefinitionCommand(
        input as unknown as RegisterTaskDefinitionCommand["input"],
      ),
    );
  cache.invalidate("taskdefs:");
  const td = res.taskDefinition!;
  const tags: Record<string, string> = {};
  for (const t of res.tags ?? []) if (t.key) tags[t.key] = t.value ?? "";
  return { ...toRevisionSummary(td), json: td as Record<string, unknown>, tags };
}

export async function deregisterTaskDef(
  clients: ClientRegistry,
  cache: TtlCache,
  ref: string,
): Promise<void> {
  await clients.ecs().send(new DeregisterTaskDefinitionCommand({ taskDefinition: ref }));
  cache.invalidate("taskdefs:");
}
