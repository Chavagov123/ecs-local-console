import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";

/** Drop the read query family that a tagged resource belongs to. */
function invalidateForArn(qc: ReturnType<typeof useQueryClient>, arn: string) {
  if (arn.includes(":cluster/")) void qc.invalidateQueries({ queryKey: ["clusters"] });
  else if (arn.includes(":service/")) void qc.invalidateQueries({ queryKey: ["clusters"] });
  else if (arn.includes(":task/")) void qc.invalidateQueries({ queryKey: ["clusters"] });
  else if (arn.includes(":task-definition/"))
    void qc.invalidateQueries({ queryKey: ["task-definitions"] });
}

export function useAddTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { resourceArn: string; tags: Record<string, string> }) =>
      apiFetch<void>("/tags", { method: "POST", body: v }),
    onSuccess: (_d, v) => invalidateForArn(qc, v.resourceArn),
  });
}

export function useRemoveTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { resourceArn: string; tagKeys: string[] }) =>
      apiFetch<void>("/tags", { method: "DELETE", body: v }),
    onSuccess: (_d, v) => invalidateForArn(qc, v.resourceArn),
  });
}
