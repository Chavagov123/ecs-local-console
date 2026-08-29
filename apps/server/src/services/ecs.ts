import {
  CreateClusterCommand,
  DeleteClusterCommand,
  DescribeClustersCommand,
  ListClustersCommand,
  type Cluster,
} from "@aws-sdk/client-ecs";
import type { ClusterDetail, ClusterSummary } from "@ecs-local-console/shared";
import type { ClientRegistry } from "../aws/clients.js";
import type { TtlCache } from "./cache.js";

function tagsToRecord(tags: { key?: string; value?: string }[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const t of tags ?? []) if (t.key) out[t.key] = t.value ?? "";
  return out;
}

/** Some emulators briefly report negative counts during churn; never surface those. */
export const nonNeg = (n: number | undefined): number => Math.max(0, n ?? 0);

export function toClusterSummary(c: Cluster): ClusterSummary {
  return {
    name: c.clusterName ?? "",
    arn: c.clusterArn ?? "",
    status: c.status ?? "UNKNOWN",
    registeredContainerInstancesCount: nonNeg(c.registeredContainerInstancesCount),
    runningTasksCount: nonNeg(c.runningTasksCount),
    pendingTasksCount: nonNeg(c.pendingTasksCount),
    activeServicesCount: nonNeg(c.activeServicesCount),
    tags: tagsToRecord(c.tags),
  };
}

/** Chunk an array into slices of at most `size`. */
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function listClusters(
  clients: ClientRegistry,
  cache: TtlCache,
): Promise<ClusterSummary[]> {
  return cache.wrap("clusters:list", async () => {
    const ecs = clients.ecs();
    const arns: string[] = [];
    let nextToken: string | undefined;
    do {
      const page = await ecs.send(new ListClustersCommand({ nextToken }));
      arns.push(...(page.clusterArns ?? []));
      nextToken = page.nextToken;
    } while (nextToken);

    if (arns.length === 0) return [];

    const clusters: Cluster[] = [];
    for (const group of chunk(arns, 100)) {
      const desc = await ecs.send(
        new DescribeClustersCommand({ clusters: group, include: ["STATISTICS", "TAGS"] }),
      );
      clusters.push(...(desc.clusters ?? []));
    }
    return clusters.map(toClusterSummary).sort((a, b) => a.name.localeCompare(b.name));
  });
}

export async function describeCluster(
  clients: ClientRegistry,
  cache: TtlCache,
  cluster: string,
): Promise<ClusterDetail> {
  return cache.wrap(`clusters:detail:${cluster}`, async () => {
    const res = await clients.ecs().send(
      new DescribeClustersCommand({
        clusters: [cluster],
        include: ["STATISTICS", "TAGS", "SETTINGS", "ATTACHMENTS"],
      }),
    );
    const c = res.clusters?.[0];
    if (!c) {
      const reason = res.failures?.[0]?.reason;
      const msg =
        reason && reason !== "MISSING"
          ? `Cluster "${cluster}": ${reason}`
          : `Cluster "${cluster}" not found`;
      throw Object.assign(new Error(msg), { name: "ClusterNotFoundException" });
    }
    const statistics: Record<string, string> = {};
    for (const kv of c.statistics ?? []) if (kv.name) statistics[kv.name] = kv.value ?? "";
    const settings: Record<string, string> = {};
    for (const kv of c.settings ?? []) if (kv.name) settings[kv.name] = kv.value ?? "";
    return {
      ...toClusterSummary(c),
      statistics,
      settings,
      capacityProviders: c.capacityProviders ?? [],
      defaultCapacityProviderStrategy: (c.defaultCapacityProviderStrategy ?? []).map((s) => ({
        capacityProvider: s.capacityProvider ?? "",
        weight: s.weight,
        base: s.base,
      })),
    };
  });
}

export async function createCluster(
  clients: ClientRegistry,
  cache: TtlCache,
  input: { clusterName: string; tags?: Record<string, string> },
): Promise<ClusterSummary> {
  const res = await clients.ecs().send(
    new CreateClusterCommand({
      clusterName: input.clusterName,
      tags: input.tags
        ? Object.entries(input.tags).map(([key, value]) => ({ key, value }))
        : undefined,
    }),
  );
  cache.invalidate("clusters:");
  return toClusterSummary(res.cluster ?? { clusterName: input.clusterName });
}

export async function deleteCluster(
  clients: ClientRegistry,
  cache: TtlCache,
  cluster: string,
): Promise<void> {
  await clients.ecs().send(new DeleteClusterCommand({ cluster }));
  cache.invalidate("clusters:");
}
