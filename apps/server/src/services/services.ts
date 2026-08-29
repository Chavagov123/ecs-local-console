import {
  DescribeServicesCommand,
  ListServicesCommand,
  type Service,
} from "@aws-sdk/client-ecs";
import type {
  ServiceDeployment,
  ServiceDetail,
  ServiceEvent,
  ServiceSummary,
} from "@ecs-local-console/shared";
import type { ClientRegistry } from "../aws/clients.js";
import type { TtlCache } from "./cache.js";
import { chunk } from "./ecs.js";

function shortName(arn: string | undefined): string {
  if (!arn) return "";
  return arn.includes("/") ? arn.slice(arn.lastIndexOf("/") + 1) : arn;
}

function tdName(arn: string | undefined): string {
  if (!arn) return "";
  const tail = arn.includes("task-definition/") ? arn.slice(arn.indexOf("task-definition/") + 16) : arn;
  return tail;
}

function deploymentInProgress(s: Service): boolean {
  const deps = s.deployments ?? [];
  if (deps.some((d) => d.rolloutState && d.rolloutState !== "COMPLETED")) return true;
  if (deps.length > 1) return true;
  return (s.runningCount ?? 0) !== (s.desiredCount ?? 0);
}

export function toServiceSummary(s: Service): ServiceSummary {
  return {
    name: s.serviceName ?? shortName(s.serviceArn),
    arn: s.serviceArn ?? "",
    clusterArn: s.clusterArn ?? "",
    status: s.status ?? "UNKNOWN",
    taskDefinition: tdName(s.taskDefinition),
    desiredCount: s.desiredCount ?? 0,
    runningCount: s.runningCount ?? 0,
    pendingCount: s.pendingCount ?? 0,
    launchType: s.launchType,
    schedulingStrategy: s.schedulingStrategy,
    createdAt: s.createdAt?.toISOString(),
    deploymentInProgress: deploymentInProgress(s),
  };
}

function toDeployment(d: NonNullable<Service["deployments"]>[number]): ServiceDeployment {
  return {
    id: d.id ?? "",
    status: d.status ?? "",
    taskDefinition: tdName(d.taskDefinition),
    desiredCount: d.desiredCount ?? 0,
    pendingCount: d.pendingCount ?? 0,
    runningCount: d.runningCount ?? 0,
    failedTasks: d.failedTasks ?? 0,
    rolloutState: d.rolloutState,
    rolloutStateReason: d.rolloutStateReason,
    createdAt: d.createdAt?.toISOString(),
    updatedAt: d.updatedAt?.toISOString(),
  };
}

function toEvent(e: NonNullable<Service["events"]>[number]): ServiceEvent {
  return {
    id: e.id ?? "",
    createdAt: e.createdAt?.toISOString(),
    message: e.message ?? "",
  };
}

export function toServiceDetail(s: Service): ServiceDetail {
  const tags: Record<string, string> = {};
  for (const t of s.tags ?? []) if (t.key) tags[t.key] = t.value ?? "";
  return {
    ...toServiceSummary(s),
    roleArn: s.roleArn,
    propagateTags: s.propagateTags,
    enableExecuteCommand: s.enableExecuteCommand,
    deploymentConfiguration: s.deploymentConfiguration
      ? {
          minimumHealthyPercent: s.deploymentConfiguration.minimumHealthyPercent,
          maximumPercent: s.deploymentConfiguration.maximumPercent,
          deploymentCircuitBreaker: s.deploymentConfiguration.deploymentCircuitBreaker
            ? {
                enable: !!s.deploymentConfiguration.deploymentCircuitBreaker.enable,
                rollback: !!s.deploymentConfiguration.deploymentCircuitBreaker.rollback,
              }
            : undefined,
        }
      : undefined,
    networkConfiguration: s.networkConfiguration?.awsvpcConfiguration
      ? {
          awsvpcConfiguration: {
            subnets: s.networkConfiguration.awsvpcConfiguration.subnets ?? [],
            securityGroups: s.networkConfiguration.awsvpcConfiguration.securityGroups ?? [],
            assignPublicIp: s.networkConfiguration.awsvpcConfiguration.assignPublicIp,
          },
        }
      : undefined,
    loadBalancers: (s.loadBalancers ?? []).map((lb) => ({
      targetGroupArn: lb.targetGroupArn,
      loadBalancerName: lb.loadBalancerName,
      containerName: lb.containerName,
      containerPort: lb.containerPort,
    })),
    serviceRegistries: (s.serviceRegistries ?? []).map((r) => ({
      registryArn: r.registryArn,
      containerName: r.containerName,
      containerPort: r.containerPort,
    })),
    deployments: (s.deployments ?? []).map(toDeployment),
    events: (s.events ?? []).slice(0, 50).map(toEvent),
    tags,
  };
}

export async function listServices(
  clients: ClientRegistry,
  cache: TtlCache,
  cluster: string,
): Promise<ServiceSummary[]> {
  return cache.wrap(`services:list:${cluster}`, async () => {
    const ecs = clients.ecs();
    const arns: string[] = [];
    let nextToken: string | undefined;
    do {
      const page = await ecs.send(new ListServicesCommand({ cluster, nextToken }));
      arns.push(...(page.serviceArns ?? []));
      nextToken = page.nextToken;
    } while (nextToken);

    if (arns.length === 0) return [];
    const out: ServiceSummary[] = [];
    for (const group of chunk(arns, 10)) {
      const desc = await ecs.send(new DescribeServicesCommand({ cluster, services: group }));
      out.push(...(desc.services ?? []).map(toServiceSummary));
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  });
}

export async function describeService(
  clients: ClientRegistry,
  cache: TtlCache,
  cluster: string,
  service: string,
): Promise<ServiceDetail> {
  return cache.wrap(`services:detail:${cluster}:${service}`, async () => {
    const res = await clients.ecs().send(
      new DescribeServicesCommand({ cluster, services: [service], include: ["TAGS"] }),
    );
    const s = res.services?.[0];
    if (!s) {
      throw Object.assign(new Error(`Service ${service} not found in ${cluster}`), {
        name: "ServiceNotFoundException",
      });
    }
    return toServiceDetail(s);
  });
}
