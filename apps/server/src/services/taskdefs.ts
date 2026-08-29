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
import type { TtlCache } from "./cache.js";

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
  return cache.wrap("taskdefs:families", async () => {
    const ecs = clients.ecs();
    const families: string[] = [];
    let nextToken: string | undefined;
    do {
      const page = await ecs.send(new ListTaskDefinitionFamiliesCommand({ status: "ALL", nextToken }));
      families.push(...(page.families ?? []));
      nextToken = page.nextToken;
    } while (nextToken);

    // One ListTaskDefinitions per family to get the latest revision + active count.
    const out: TaskDefFamily[] = [];
    for (const family of families.sort()) {
      const active = await ecs.send(
        new ListTaskDefinitionsCommand({ familyPrefix: family, status: "ACTIVE", sort: "DESC" }),
      );
      const arns = active.taskDefinitionArns ?? [];
      out.push({
        family,
        latestRevision: arns[0] ? revFromArn(arns[0]) : undefined,
        activeRevisions: arns.length,
        status: arns.length > 0 ? "ACTIVE" : "INACTIVE",
      });
    }
    return out;
  });
}

export async function listRevisions(
  clients: ClientRegistry,
  cache: TtlCache,
  family: string,
): Promise<TaskDefRevisionSummary[]> {
  return cache.wrap(`taskdefs:revisions:${family}`, async () => {
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

    // Describe each revision (LocalStack lists are small; cap to a sane number).
    const out: TaskDefRevisionSummary[] = [];
    for (const arn of arns.slice(0, 100)) {
      const d = await ecs.send(new DescribeTaskDefinitionCommand({ taskDefinition: arn }));
      if (d.taskDefinition) out.push(toRevisionSummary(d.taskDefinition));
    }
    return out;
  });
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
