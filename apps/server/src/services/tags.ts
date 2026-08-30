import { TagResourceCommand, UntagResourceCommand } from "@aws-sdk/client-ecs";
import type { ClientRegistry } from "../aws/clients.js";
import type { TtlCache } from "./cache.js";

/** Map an ECS ARN to the read-cache prefix that should be dropped after a tag write. */
function prefixForArn(arn: string): string {
  if (arn.includes(":cluster/")) return "clusters:";
  if (arn.includes(":service/")) return "services:";
  if (arn.includes(":task/")) return "tasks:";
  if (arn.includes(":task-definition/")) return "taskdefs:";
  return "";
}

function invalidate(cache: TtlCache, arn: string): void {
  const prefix = prefixForArn(arn);
  if (prefix) cache.invalidate(prefix);
}

export async function addTags(
  clients: ClientRegistry,
  cache: TtlCache,
  resourceArn: string,
  tags: Record<string, string>,
): Promise<void> {
  await clients.ecs().send(
    new TagResourceCommand({
      resourceArn,
      tags: Object.entries(tags).map(([key, value]) => ({ key, value })),
    }),
  );
  invalidate(cache, resourceArn);
}

export async function removeTags(
  clients: ClientRegistry,
  cache: TtlCache,
  resourceArn: string,
  tagKeys: string[],
): Promise<void> {
  await clients.ecs().send(new UntagResourceCommand({ resourceArn, tagKeys }));
  invalidate(cache, resourceArn);
}
