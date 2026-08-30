import type {
  CreateServiceRequest,
  ServiceDetail,
  ServiceSummary,
  TaskSummary,
  UpdateServiceRequest,
} from "@ecs-local-console/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mutationErrorToast } from "@/lib/mutation-toast";
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

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Every service mutation moves task counts; drop the same three read families. */
function invalidateService(qc: ReturnType<typeof useQueryClient>, cluster: string, service?: string) {
  void qc.invalidateQueries({ queryKey: qk.services(cluster) });
  void qc.invalidateQueries({ queryKey: qk.cluster(cluster) });
  void qc.invalidateQueries({ queryKey: qk.clusters() });
  void qc.invalidateQueries({ queryKey: qk.tasks(cluster) });
  void qc.invalidateQueries({ queryKey: qk.allTasks() });
  if (service) {
    void qc.invalidateQueries({ queryKey: qk.service(cluster, service) });
    void qc.invalidateQueries({ queryKey: qk.serviceTasks(cluster, service) });
  }
}

export function useCreateService(cluster: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateServiceRequest) =>
      apiFetch<ServiceDetail>(`/clusters/${enc(cluster)}/services`, { method: "POST", body }),
    onSuccess: (svc) => invalidateService(qc, cluster, svc.name),
  });
}

export function useDeleteService(cluster: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ service, force }: { service: string; force?: boolean }) =>
      apiFetch<void>(`/clusters/${enc(cluster)}/services/${enc(service)}`, {
        method: "DELETE",
        query: { force: force ? "true" : undefined },
      }),
    onSuccess: (_v, { service }) => invalidateService(qc, cluster, service),
  });
}

interface UpdateArgs extends UpdateServiceRequest {
  service: string;
}

type ServiceSnapshot = {
  detail?: ServiceDetail;
  list?: ServiceSummary[];
};

/**
 * `desiredCount`-only patches update the cache optimistically so the stepper
 * feels instant; anything else just fires and invalidates.
 * Order: onMutate (cancel + snapshot + patch) → onError (rollback) → onSettled (invalidate).
 */
export function useUpdateService(cluster: string) {
  const qc = useQueryClient();
  return useMutation<ServiceDetail, unknown, UpdateArgs, ServiceSnapshot>({
    mutationFn: ({ service, ...patch }) =>
      apiFetch<ServiceDetail>(`/clusters/${enc(cluster)}/services/${enc(service)}`, {
        method: "PATCH",
        body: patch,
      }),
    onMutate: async ({ service, ...patch }) => {
      const isCountOnly =
        typeof patch.desiredCount === "number" &&
        patch.taskDefinition === undefined &&
        patch.forceNewDeployment === undefined &&
        patch.networkConfiguration === undefined;
      if (!isCountOnly) return {};

      await qc.cancelQueries({ queryKey: qk.service(cluster, service) });
      await qc.cancelQueries({ queryKey: qk.services(cluster) });
      const detail = qc.getQueryData<ServiceDetail>(qk.service(cluster, service));
      const list = qc.getQueryData<ServiceSummary[]>(qk.services(cluster));
      const n = patch.desiredCount!;

      if (detail) {
        qc.setQueryData<ServiceDetail>(qk.service(cluster, service), {
          ...detail,
          desiredCount: n,
          deploymentInProgress: true,
        });
      }
      if (list) {
        qc.setQueryData<ServiceSummary[]>(
          qk.services(cluster),
          list.map((s) =>
            s.name === service ? { ...s, desiredCount: n, deploymentInProgress: true } : s,
          ),
        );
      }
      return { detail, list };
    },
    onError: (err, { service }, ctx) => {
      if (ctx?.detail) qc.setQueryData(qk.service(cluster, service), ctx.detail);
      if (ctx?.list) qc.setQueryData(qk.services(cluster), ctx.list);
      mutationErrorToast(err);
    },
    onSettled: (_d, _e, { service }) => invalidateService(qc, cluster, service),
  });
}
