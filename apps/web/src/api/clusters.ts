import type {
  ClusterDetail,
  ClusterSummary,
  CreateClusterRequest,
} from "@ecs-local-console/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import { qk } from "./keys";

export function useClusters() {
  return useQuery({
    queryKey: qk.clusters(),
    queryFn: ({ signal }) => apiFetch<ClusterSummary[]>("/clusters", { signal }),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}

export function useCluster(cluster: string) {
  return useQuery({
    queryKey: qk.cluster(cluster),
    queryFn: ({ signal }) =>
      apiFetch<ClusterDetail>(`/clusters/${encodeURIComponent(cluster)}`, { signal }),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
}

export function useCreateCluster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateClusterRequest) =>
      apiFetch<ClusterSummary>("/clusters", { method: "POST", body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.clusters() }),
  });
}

export function useDeleteCluster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cluster: string) =>
      apiFetch<void>(`/clusters/${encodeURIComponent(cluster)}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.clusters() }),
  });
}
