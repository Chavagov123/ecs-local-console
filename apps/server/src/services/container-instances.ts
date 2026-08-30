/**
 * EC2-launch-type container instances for a cluster. Normally empty on
 * Fargate / LocalStack, but real ECS-on-EC2 users want to see them.
 */
import {
  DescribeContainerInstancesCommand,
  ListContainerInstancesCommand,
} from "@aws-sdk/client-ecs";
import type { ContainerInstance } from "@ecs-local-console/shared";
import type { ClientRegistry } from "../aws/clients.js";
import { chunk, nonNeg } from "./ecs.js";
import type { TtlCache } from "./cache.js";

function idFromArn(arn: string | undefined): string {
  return arn ? arn.slice(arn.lastIndexOf("/") + 1) : "";
}

export async function listContainerInstances(
  clients: ClientRegistry,
  cache: TtlCache,
  cluster: string,
): Promise<ContainerInstance[]> {
  return cache.wrap(
    `clusters:container-instances:${cluster}`,
    async () => {
      const ecs = clients.ecs();
      const arns: string[] = [];
      let nextToken: string | undefined;
      do {
        const page = await ecs.send(
          new ListContainerInstancesCommand({ cluster, nextToken }),
        );
        arns.push(...(page.containerInstanceArns ?? []));
        nextToken = page.nextToken;
      } while (nextToken);
      if (arns.length === 0) return [];

      const out: ContainerInstance[] = [];
      for (const group of chunk(arns, 100)) {
        const desc = await ecs.send(
          new DescribeContainerInstancesCommand({ cluster, containerInstances: group }),
        );
        for (const ci of desc.containerInstances ?? []) {
          out.push({
            containerInstanceId: idFromArn(ci.containerInstanceArn),
            arn: ci.containerInstanceArn ?? "",
            ec2InstanceId: ci.ec2InstanceId,
            status: ci.status ?? "UNKNOWN",
            agentConnected: !!ci.agentConnected,
            runningTasksCount: nonNeg(ci.runningTasksCount),
            pendingTasksCount: nonNeg(ci.pendingTasksCount),
            registeredAt: ci.registeredAt?.toISOString(),
            capacityProviderName: ci.capacityProviderName,
          });
        }
      }
      return out.sort((a, b) => a.containerInstanceId.localeCompare(b.containerInstanceId));
    },
    10_000,
  );
}
