import {
  DescribeSecurityGroupsCommand,
  DescribeSubnetsCommand,
  DescribeVpcsCommand,
} from "@aws-sdk/client-ec2";
import type { SecurityGroup, Subnet, Vpc } from "@ecs-local-console/shared";
import type { ClientRegistry } from "../aws/clients.js";
import type { TtlCache } from "./cache.js";

/** Infra changes rarely; a generous TTL keeps picker opens cheap. */
const NET_TTL = 30_000;

function nameTag(tags: { Key?: string; Value?: string }[] | undefined): string | undefined {
  return tags?.find((t) => t.Key === "Name")?.Value;
}

export async function listVpcs(clients: ClientRegistry, cache: TtlCache): Promise<Vpc[]> {
  return cache.wrap(
    "networking:vpcs",
    async () => {
      const res = await clients.ec2().send(new DescribeVpcsCommand({}));
      return (res.Vpcs ?? [])
        .map((v) => ({
          vpcId: v.VpcId ?? "",
          cidrBlock: v.CidrBlock,
          isDefault: !!v.IsDefault,
          name: nameTag(v.Tags),
        }))
        .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
    },
    NET_TTL,
  );
}

export async function listSubnets(
  clients: ClientRegistry,
  cache: TtlCache,
  vpcId?: string,
): Promise<Subnet[]> {
  return cache.wrap(
    `networking:subnets:${vpcId ?? "*"}`,
    async () => {
      const res = await clients.ec2().send(
        new DescribeSubnetsCommand(
          vpcId ? { Filters: [{ Name: "vpc-id", Values: [vpcId] }] } : {},
        ),
      );
      return (res.Subnets ?? [])
        .map((s) => ({
          subnetId: s.SubnetId ?? "",
          vpcId: s.VpcId,
          cidrBlock: s.CidrBlock,
          availabilityZone: s.AvailabilityZone,
          mapPublicIpOnLaunch: !!s.MapPublicIpOnLaunch,
          name: nameTag(s.Tags),
        }))
        .sort((a, b) => (a.availabilityZone ?? "").localeCompare(b.availabilityZone ?? ""));
    },
    NET_TTL,
  );
}

export async function listSecurityGroups(
  clients: ClientRegistry,
  cache: TtlCache,
  vpcId?: string,
): Promise<SecurityGroup[]> {
  return cache.wrap(
    `networking:sg:${vpcId ?? "*"}`,
    async () => {
      const res = await clients.ec2().send(
        new DescribeSecurityGroupsCommand(
          vpcId ? { Filters: [{ Name: "vpc-id", Values: [vpcId] }] } : {},
        ),
      );
      return (res.SecurityGroups ?? [])
        .map((g) => ({
          groupId: g.GroupId ?? "",
          groupName: g.GroupName,
          vpcId: g.VpcId,
          description: g.Description,
        }))
        .sort((a, b) => (a.groupName ?? "").localeCompare(b.groupName ?? ""));
    },
    NET_TTL,
  );
}
