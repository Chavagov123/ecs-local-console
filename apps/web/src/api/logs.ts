import type {
  ContainerInstance,
  Eni,
  LogGroup,
  LogPage,
  TaskLogConfig,
} from "@ecs-local-console/shared";
import {
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { apiFetch } from "./client";
import { qk } from "./keys";

const enc = encodeURIComponent;

export function useLogGroups(prefix?: string) {
  return useQuery({
    queryKey: qk.logGroups(prefix),
    queryFn: ({ signal }) =>
      apiFetch<{ groups: LogGroup[]; nextToken?: string }>("/logs/groups", {
        signal,
        query: { prefix },
      }),
    staleTime: 10_000,
  });
}

export interface LogEventParams {
  logGroup: string;
  logStream?: string;
  filterPattern?: string;
  start?: number;
  end?: number;
  follow?: boolean;
}

/**
 * Backward pagination ("load older") via `nextBackwardToken`. When `follow` is
 * on and the tab is visible, refetch the first page every 2s.
 */
export function useLogEvents(p: LogEventParams) {
  return useInfiniteQuery({
    queryKey: qk.logEvents(p),
    enabled: !!p.logGroup,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      apiFetch<LogPage>("/logs", {
        signal,
        query: {
          logGroup: p.logGroup,
          logStream: p.logStream,
          filterPattern: p.filterPattern,
          start: p.start,
          end: p.end,
          nextToken: pageParam,
        },
      }),
    getNextPageParam: (last) => last.nextBackwardToken,
    getPreviousPageParam: (first) => first.nextForwardToken,
    refetchInterval:
      p.follow && typeof document !== "undefined" && document.visibilityState === "visible"
        ? 2_000
        : false,
    refetchIntervalInBackground: false,
  });
}

export function useTaskLogConfig(cluster: string, taskId: string) {
  return useQuery({
    queryKey: qk.taskLogConfig(cluster, taskId),
    queryFn: ({ signal }) =>
      apiFetch<TaskLogConfig>(
        `/clusters/${enc(cluster)}/tasks/${enc(taskId)}/log-config`,
        { signal },
      ),
    staleTime: 30_000,
  });
}

export function useTaskEnis(cluster: string, taskId: string, enabled = true) {
  return useQuery({
    queryKey: qk.taskEnis(cluster, taskId),
    enabled,
    queryFn: ({ signal }) =>
      apiFetch<Eni[]>(`/clusters/${enc(cluster)}/tasks/${enc(taskId)}/enis`, { signal }),
    staleTime: 30_000,
  });
}

export function useContainerInstances(cluster: string) {
  return useQuery({
    queryKey: qk.containerInstances(cluster),
    queryFn: ({ signal }) =>
      apiFetch<ContainerInstance[]>(
        `/clusters/${enc(cluster)}/container-instances`,
        { signal },
      ),
    staleTime: 15_000,
  });
}
