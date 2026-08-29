import type {
  TaskDefDetail,
  TaskDefFamily,
  TaskDefRevisionSummary,
} from "@ecs-local-console/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import { qk } from "./keys";

const enc = encodeURIComponent;

export function useTaskDefFamilies() {
  return useQuery({
    queryKey: qk.taskDefFamilies(),
    queryFn: ({ signal }) => apiFetch<TaskDefFamily[]>("/task-definitions", { signal }),
    refetchInterval: 20_000,
    refetchIntervalInBackground: false,
  });
}

export function useTaskDefRevisions(family: string) {
  return useQuery({
    queryKey: qk.taskDefFamily(family),
    queryFn: ({ signal }) =>
      apiFetch<TaskDefRevisionSummary[]>(`/task-definitions/${enc(family)}`, { signal }),
  });
}

export function useTaskDef(family: string, revision: string) {
  return useQuery({
    queryKey: qk.taskDef(family, revision),
    queryFn: ({ signal }) =>
      apiFetch<TaskDefDetail>(`/task-definitions/${enc(family)}/${enc(revision)}`, { signal }),
  });
}

export function useRegisterTaskDef() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (json: Record<string, unknown>) =>
      apiFetch<TaskDefDetail>("/task-definitions", { method: "POST", body: json }),
    onSuccess: (td) => {
      void qc.invalidateQueries({ queryKey: qk.taskDefFamilies() });
      void qc.invalidateQueries({ queryKey: qk.taskDefFamily(td.family) });
    },
  });
}

export function useDeregisterTaskDef() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ family, revision }: { family: string; revision: number }) =>
      apiFetch<void>(`/task-definitions/${enc(family)}/${revision}`, { method: "DELETE" }),
    onSuccess: (_v, { family }) => {
      void qc.invalidateQueries({ queryKey: qk.taskDefFamilies() });
      void qc.invalidateQueries({ queryKey: qk.taskDefFamily(family) });
    },
  });
}
