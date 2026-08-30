import type {
  ClusterSummary,
  HealthResponse,
  RuntimeConfigResponse,
  ServiceSummary,
  TaskDefFamily,
} from "@ecs-local-console/shared";
import { http, HttpResponse } from "msw";

export const fixtures = {
  health: {
    reachable: true,
    ecsAvailable: true,
    endpoint: "http://localhost:4566",
    region: "us-east-1",
    flavor: "localstack",
  } satisfies HealthResponse,
  config: {
    endpoint: "http://localhost:4566",
    region: "us-east-1",
    credentialsMode: "static",
    endpointIsRemote: false,
    source: "env",
  } satisfies RuntimeConfigResponse,
  clusters: [
    {
      name: "demo",
      arn: "arn:aws:ecs:us-east-1:0:cluster/demo",
      status: "ACTIVE",
      registeredContainerInstancesCount: 0,
      runningTasksCount: 2,
      pendingTasksCount: 0,
      activeServicesCount: 1,
      tags: {},
    },
  ] satisfies ClusterSummary[],
  services: [
    {
      name: "web",
      arn: "arn:aws:ecs:us-east-1:0:service/demo/web",
      clusterArn: "arn:aws:ecs:us-east-1:0:cluster/demo",
      status: "ACTIVE",
      taskDefinition: "web:2",
      desiredCount: 2,
      runningCount: 2,
      pendingCount: 0,
      launchType: "FARGATE",
      deploymentInProgress: false,
    },
  ] satisfies ServiceSummary[],
  families: [
    { family: "web", latestRevision: 2, activeRevisions: 2, status: "ACTIVE" },
  ] satisfies TaskDefFamily[],
};

const api = (p: string) => `*/api${p}`;

export const handlers = [
  http.get(api("/health"), () => HttpResponse.json(fixtures.health)),
  http.get(api("/config"), () => HttpResponse.json(fixtures.config)),
  http.get(api("/clusters"), () => HttpResponse.json(fixtures.clusters)),
  http.get(api("/clusters/:cluster"), ({ params }) =>
    HttpResponse.json({
      ...fixtures.clusters[0],
      name: params.cluster,
      statistics: {},
      settings: {},
      capacityProviders: [],
      defaultCapacityProviderStrategy: [],
    }),
  ),
  http.get(api("/clusters/:cluster/services"), () => HttpResponse.json(fixtures.services)),
  http.get(api("/clusters/:cluster/services/:service"), ({ params }) =>
    HttpResponse.json({
      ...fixtures.services[0],
      name: params.service,
      loadBalancers: [],
      serviceRegistries: [],
      deployments: [],
      events: [],
      tags: {},
    }),
  ),
  http.get(api("/clusters/:cluster/services/:service/tasks"), () => HttpResponse.json([])),
  http.get(api("/clusters/:cluster/tasks"), () => HttpResponse.json([])),
  http.get(api("/tasks"), () => HttpResponse.json([])),
  http.get(api("/task-definitions"), () => HttpResponse.json(fixtures.families)),
  http.get(api("/task-definitions/:family"), () => HttpResponse.json([])),
  http.get(api("/networking/subnets"), () => HttpResponse.json([])),
  http.get(api("/networking/security-groups"), () => HttpResponse.json([])),
  http.get(api("/iam/roles"), () => HttpResponse.json([])),
];
