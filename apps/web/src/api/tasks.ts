import type { TaskDetail, TaskSummary } from "@ecs-local-console/shared";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import { qk } from "./keys";

const enc = encodeURIComponent;

export interface TaskFilters {
  desiredStatus?: "RUNNING" | "PENDING" | "STOPPED";
  family?: string;
}

export function useClusterTasks(cluster: string, filters: TaskFilters = {}) {
  return useQuery({
    queryKey: [...qk.tasks(cluster), filters] as const,
    queryFn: ({ signal }) =>
      apiFetch<TaskSummary[]>(`/clusters/${enc(cluster)}/tasks`, { signal, query: filters }),
    refetchInterval: (q) =>
      (q.state.data ?? []).some((t) => t.transitioning) ? 3_000 : 12_000,
    refetchIntervalInBackground: false,
  });
}

export function useAllTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: [...qk.allTasks(), filters] as const,
    queryFn: ({ signal }) => apiFetch<TaskSummary[]>("/tasks", { signal, query: filters }),
    refetchInterval: (q) =>
      (q.state.data ?? []).some((t) => t.transitioning) ? 4_000 : 15_000,
    refetchIntervalInBackground: false,
  });
}

export function useTask(cluster: string, taskId: string) {
  return useQuery({
    queryKey: qk.task(cluster, taskId),
    queryFn: ({ signal }) =>
      apiFetch<TaskDetail>(`/clusters/${enc(cluster)}/tasks/${enc(taskId)}`, { signal }),
    refetchInterval: (q) => {
      const d = q.state.data;
      if (!d) return 5_000;
      return d.transitioning ? 2_000 : 12_000;
    },
    refetchIntervalInBackground: false,
  });
}
