import type { UseMutationResult } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ApiError } from "@/api/client";

/** Show a mutation's error as a toast (message + optional remediation hint). */
export function mutationErrorToast(e: unknown): void {
  const err = e as Partial<ApiError>;
  toast.error(err?.message ?? "Something went wrong", { description: err?.hint });
}

/**
 * Wraps a react-query mutation so call sites stop repeating
 * `try { await mut.mutateAsync() ; toast.success() } catch { toast.error() }`.
 * `run()` toasts success/error and still rethrows on error so a dialog can stay open.
 */
export function useMutationToast<TArgs, TData>(
  mutation: UseMutationResult<TData, unknown, TArgs>,
  opts: { success: string | ((d: TData) => string); error?: string },
): UseMutationResult<TData, unknown, TArgs> & { run: (args: TArgs) => Promise<TData> } {
  const run = async (args: TArgs): Promise<TData> => {
    try {
      const d = await mutation.mutateAsync(args);
      toast.success(typeof opts.success === "function" ? opts.success(d) : opts.success);
      return d;
    } catch (e) {
      if (opts.error) toast.error(opts.error, { description: (e as Partial<ApiError>)?.hint });
      else mutationErrorToast(e);
      throw e;
    }
  };
  return { ...mutation, run };
}
