/**
 * Resolve the elastic network interfaces attached to an `awsvpc` task, hydrating
 * the ENI ids from the task's attachments with EC2 `DescribeNetworkInterfaces`.
 */
import { DescribeNetworkInterfacesCommand } from "@aws-sdk/client-ec2";
import { DescribeTasksCommand } from "@aws-sdk/client-ecs";
import type { Eni } from "@ecs-local-console/shared";
import type { ClientRegistry } from "../aws/clients.js";
import type { TtlCache } from "./cache.js";

export async function taskEnis(
  clients: ClientRegistry,
  cache: TtlCache,
  cluster: string,
  taskId: string,
): Promise<Eni[]> {
  return cache.wrap(
    `networking:enis:${cluster}:${taskId}`,
    async () => {
      const desc = await clients
        .ecs()
        .send(new DescribeTasksCommand({ cluster, tasks: [taskId] }));
      const task = desc.tasks?.[0];
      if (!task) return [];

      const eniIds: string[] = [];
      for (const a of task.attachments ?? []) {
        if (a.type !== "ElasticNetworkInterface") continue;
        const id = a.details?.find((d) => d.name === "networkInterfaceId")?.value;
        if (id) eniIds.push(id);
      }
      if (eniIds.length === 0) return [];

      const res = await clients
        .ec2()
        .send(new DescribeNetworkInterfacesCommand({ NetworkInterfaceIds: eniIds }));
      return (res.NetworkInterfaces ?? []).map((ni) => ({
        networkInterfaceId: ni.NetworkInterfaceId ?? "",
        privateIpAddress: ni.PrivateIpAddress,
        privateDnsName: ni.PrivateDnsName,
        publicIp: ni.Association?.PublicIp,
        subnetId: ni.SubnetId,
        vpcId: ni.VpcId,
        availabilityZone: ni.AvailabilityZone,
        securityGroups: (ni.Groups ?? []).map((g) => ({
          groupId: g.GroupId ?? "",
          groupName: g.GroupName,
        })),
        status: ni.Status,
      }));
    },
    15_000,
  );
}
