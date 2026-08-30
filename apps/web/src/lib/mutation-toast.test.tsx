import { useMutation } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import { useMutationToast } from "./mutation-toast";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe("useMutationToast", () => {
  beforeEach(() => {
    toast.success.mockClear();
    toast.error.mockClear();
  });

  it("toasts success with a function label", async () => {
    const { result } = renderHook(
      () => useMutationToast(useMutation({ mutationFn: async () => ({ n: 3 }) }), {
        success: (d) => `got ${d.n}`,
      }),
      { wrapper },
    );
    await act(() => result.current.run(undefined));
    expect(toast.success).toHaveBeenCalledWith("got 3");
  });

  it("toasts the ApiError message + hint and rethrows", async () => {
    const err = new ApiError(409, "CONFLICT", "already exists", "delete it first");
    const { result } = renderHook(
      () =>
        useMutationToast(
          useMutation({
            mutationFn: async () => {
              throw err;
            },
          }),
          { success: "ok" },
        ),
      { wrapper },
    );
    await expect(result.current.run(undefined)).rejects.toBe(err);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("already exists", { description: "delete it first" }),
    );
  });
});
