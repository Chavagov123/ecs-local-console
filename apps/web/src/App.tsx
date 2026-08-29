import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { ConnectionBanner, ConnectionPill } from "@/components/ConnectionBanner";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClustersList } from "@/pages/ClustersList";
import { NotFound } from "@/pages/NotFound";
import { Placeholder } from "@/pages/Placeholder";
import { Settings } from "@/pages/Settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 2_000, refetchOnWindowFocus: true },
  },
});

const isDev = import.meta.env.DEV;

function AppLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background px-4">
            <SidebarTrigger />
            <div className="flex-1" />
            <ConnectionPill />
          </header>
          <ConnectionBanner />
          <main className="min-w-0 flex-1 p-6">
            <Routes>
              <Route path="/" element={<Navigate to="/clusters" replace />} />
              <Route path="/clusters" element={<ClustersList />} />
              <Route
                path="/clusters/:cluster/*"
                element={<Placeholder title="Cluster detail" milestone="M1" />}
              />
              <Route path="/tasks" element={<Placeholder title="All tasks" milestone="M1" />} />
              <Route
                path="/task-definitions"
                element={<Placeholder title="Task definitions" milestone="M1" />}
              />
              <Route
                path="/task-definitions/new"
                element={<Placeholder title="Register task definition" milestone="M2" />}
              />
              <Route path="/logs" element={<Placeholder title="Log groups" milestone="M3" />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={200}>
        <Toaster />
        <Sonner />
        <Router>
          <AppLayout />
        </Router>
        {isDev && <ReactQueryDevtools initialIsOpen={false} />}
      </TooltipProvider>
    </QueryClientProvider>
  );
}
