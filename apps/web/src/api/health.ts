import type { HealthResponse } from "@ecs-local-console/shared";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./client";
import { qk } from "./keys";

export function useHealth() {
  return useQuery({
    queryKey: qk.health(),
    queryFn: ({ signal }) => apiFetch<HealthResponse>("/health", { signal }),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    retry: false,
    staleTime: 5_000,
  });
}
