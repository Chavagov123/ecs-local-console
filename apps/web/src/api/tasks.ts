import type {
  RunTaskRequest,
  RunTaskResult,
  TaskDetail,
  TaskSummary,
} from "@ecs-local-console/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mutationErrorToast } from "@/lib/mutation-toast";
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

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

function invalidateTasks(qc: ReturnType<typeof useQueryClient>, cluster: string) {
  void qc.invalidateQueries({ queryKey: qk.tasks(cluster) });
  void qc.invalidateQueries({ queryKey: qk.allTasks() });
  void qc.invalidateQueries({ queryKey: qk.cluster(cluster) });
  void qc.invalidateQueries({ queryKey: qk.clusters() });
}

export function useRunTask(cluster: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RunTaskRequest) =>
      apiFetch<RunTaskResult>(`/clusters/${enc(cluster)}/tasks`, { method: "POST", body }),
    onSuccess: () => invalidateTasks(qc, cluster),
  });
}

/** Optimistically flips the task to STOPPED in every list + the detail view. */
export function useStopTask(cluster: string) {
  const qc = useQueryClient();
  return useMutation<
    TaskSummary,
    unknown,
    { taskId: string; reason?: string },
    { snapshots: [readonly unknown[], unknown][] }
  >({
    mutationFn: ({ taskId, reason }) =>
      apiFetch<TaskSummary>(`/clusters/${enc(cluster)}/tasks/${enc(taskId)}`, {
        method: "DELETE",
        body: reason ? { reason } : undefined,
      }),
    onMutate: async ({ taskId }) => {
      await qc.cancelQueries({ queryKey: qk.task(cluster, taskId) });
      const snapshots: [readonly unknown[], unknown][] = [];
      const stop = (t: TaskSummary): TaskSummary =>
        t.taskId === taskId
          ? { ...t, desiredStatus: "STOPPED", transitioning: t.lastStatus !== "STOPPED" }
          : t;

      qc.getQueriesData<TaskSummary[]>({ queryKey: ["clusters"] }).forEach(([key, data]) => {
        if (Array.isArray(data) && data.some((t) => t?.taskId === taskId)) {
          snapshots.push([key, data]);
          qc.setQueryData(key, data.map(stop));
        }
      });
      qc.getQueriesData<TaskSummary[]>({ queryKey: qk.allTasks() }).forEach(([key, data]) => {
        if (Array.isArray(data)) {
          snapshots.push([key, data]);
          qc.setQueryData(key, data.map(stop));
        }
      });
      const detail = qc.getQueryData<TaskDetail>(qk.task(cluster, taskId));
      if (detail) {
        snapshots.push([qk.task(cluster, taskId), detail]);
        qc.setQueryData<TaskDetail>(qk.task(cluster, taskId), {
          ...detail,
          desiredStatus: "STOPPED",
          transitioning: detail.lastStatus !== "STOPPED",
        });
      }
      return { snapshots };
    },
    onError: (err, _v, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
      mutationErrorToast(err);
    },
    onSettled: () => invalidateTasks(qc, cluster),
  });
}
