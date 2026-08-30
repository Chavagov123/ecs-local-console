import type { IamRole, SecurityGroup, Subnet, Vpc } from "@ecs-local-console/shared";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import { qk } from "./keys";

const FIVE_MIN = 300_000;

export function useVpcs() {
  return useQuery({
    queryKey: qk.vpcs(),
    queryFn: ({ signal }) => apiFetch<Vpc[]>("/networking/vpcs", { signal }),
    staleTime: FIVE_MIN,
  });
}

export function useSubnets(vpcId?: string) {
  return useQuery({
    queryKey: qk.subnets(vpcId),
    queryFn: ({ signal }) =>
      apiFetch<Subnet[]>("/networking/subnets", { signal, query: { vpcId } }),
    staleTime: FIVE_MIN,
  });
}

export function useSecurityGroups(vpcId?: string) {
  return useQuery({
    queryKey: qk.securityGroups(vpcId),
    queryFn: ({ signal }) =>
      apiFetch<SecurityGroup[]>("/networking/security-groups", { signal, query: { vpcId } }),
    staleTime: FIVE_MIN,
  });
}

export function useIamRoles(kind?: "task" | "execution") {
  return useQuery({
    queryKey: qk.iamRoles(kind),
    queryFn: ({ signal }) =>
      apiFetch<IamRole[]>("/iam/roles", { signal, query: { kind } }),
    staleTime: FIVE_MIN,
  });
}
