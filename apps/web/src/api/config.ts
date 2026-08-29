import type {
  RuntimeConfigResponse,
  UpdateRuntimeConfigRequest,
} from "@ecs-local-console/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import { qk } from "./keys";

export function useRuntimeConfig() {
  return useQuery({
    queryKey: qk.config(),
    queryFn: ({ signal }) => apiFetch<RuntimeConfigResponse>("/config", { signal }),
    staleTime: 30_000,
  });
}

export function useUpdateRuntimeConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateRuntimeConfigRequest) =>
      apiFetch<RuntimeConfigResponse>("/config", { method: "PUT", body }),
    onSuccess: (data) => {
      qc.setQueryData(qk.config(), data);
      // Everything downstream depends on which endpoint we're pointed at.
      void qc.invalidateQueries();
    },
  });
}
