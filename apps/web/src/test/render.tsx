import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";

interface Options extends Omit<RenderOptions, "wrapper"> {
  route?: string;
  routePath?: string;
}

export function renderWithProviders(ui: ReactElement, opts: Options = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <MemoryRouter initialEntries={[opts.route ?? "/"]}>{children}</MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
  return {
    user: userEvent.setup(),
    queryClient: qc,
    ...render(ui, { wrapper: Wrapper, ...opts }),
  };
}
