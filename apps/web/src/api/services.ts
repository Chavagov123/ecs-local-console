import type { ServiceDetail, ServiceSummary, TaskSummary } from "@ecs-local-console/shared";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import { qk } from "./keys";

const enc = encodeURIComponent;

export function useServices(cluster: string) {
  return useQuery({
    queryKey: qk.services(cluster),
    queryFn: ({ signal }) =>
      apiFetch<ServiceSummary[]>(`/clusters/${enc(cluster)}/services`, { signal }),
    refetchInterval: (q) =>
      (q.state.data ?? []).some((s) => s.deploymentInProgress) ? 4_000 : 12_000,
    refetchIntervalInBackground: false,
  });
}

export function useService(cluster: string, service: string) {
  return useQuery({
    queryKey: qk.service(cluster, service),
    queryFn: ({ signal }) =>
      apiFetch<ServiceDetail>(`/clusters/${enc(cluster)}/services/${enc(service)}`, { signal }),
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d) return 8_000;
      const busy =
        d.deploymentInProgress ||
        d.deployments.some((x) => x.rolloutState === "IN_PROGRESS") ||
        d.runningCount !== d.desiredCount;
      return busy ? 3_000 : 10_000;
    },
    refetchIntervalInBackground: false,
  });
}

export function useServiceTasks(cluster: string, service: string) {
  return useQuery({
    queryKey: qk.serviceTasks(cluster, service),
    queryFn: ({ signal }) =>
      apiFetch<TaskSummary[]>(`/clusters/${enc(cluster)}/services/${enc(service)}/tasks`, {
        signal,
      }),
    refetchInterval: (q) =>
      (q.state.data ?? []).some((t) => t.transitioning) ? 3_000 : 10_000,
    refetchIntervalInBackground: false,
  });
}
