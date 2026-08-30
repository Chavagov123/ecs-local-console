import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { lazy, Suspense } from "react";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { ConnectionBanner, ConnectionPill } from "@/components/ConnectionBanner";
import { EventStreamProvider } from "@/components/events/EventStreamProvider";
import { LoadingRows } from "@/components/States";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

/** Route-level code-splitting: each page ships in its own chunk. */
const named = (loader: () => Promise<Record<string, unknown>>, key: string) =>
  lazy(() =>
    loader().then((m) => ({ default: m[key] as React.ComponentType })),
  );

const ClustersList = named(() => import("@/pages/ClustersList"), "ClustersList");
const ClusterDetail = named(() => import("@/pages/ClusterDetail"), "ClusterDetail");
const ContainerInstances = named(
  () => import("@/pages/ContainerInstances"),
  "ContainerInstances",
);
const ServiceDetail = named(() => import("@/pages/ServiceDetail"), "ServiceDetail");
const TaskDetail = named(() => import("@/pages/TaskDetail"), "TaskDetail");
const AllTasks = named(() => import("@/pages/AllTasks"), "AllTasks");
const TaskDefFamilies = named(() => import("@/pages/TaskDefFamilies"), "TaskDefFamilies");
const TaskDefRevisions = named(() => import("@/pages/TaskDefRevisions"), "TaskDefRevisions");
const TaskDefDetail = named(() => import("@/pages/TaskDefDetail"), "TaskDefDetail");
const TaskDefEditor = named(() => import("@/pages/TaskDefEditor"), "TaskDefEditor");
const Logs = named(() => import("@/pages/Logs"), "Logs");
const Settings = named(() => import("@/pages/Settings"), "Settings");
const NotFound = named(() => import("@/pages/NotFound"), "NotFound");

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
            <Suspense fallback={<LoadingRows rows={4} />}>
              <Routes>
                <Route path="/" element={<Navigate to="/clusters" replace />} />
                <Route path="/clusters" element={<ClustersList />} />
                <Route path="/clusters/:cluster" element={<ClusterDetail />} />
                <Route
                  path="/clusters/:cluster/container-instances"
                  element={<ContainerInstances />}
                />
                <Route path="/clusters/:cluster/services/:service" element={<ServiceDetail />} />
                <Route path="/clusters/:cluster/tasks/:taskId" element={<TaskDetail />} />
                <Route path="/tasks" element={<AllTasks />} />
                <Route path="/task-definitions" element={<TaskDefFamilies />} />
                <Route path="/task-definitions/new" element={<TaskDefEditor />} />
                <Route path="/task-definitions/:family" element={<TaskDefRevisions />} />
                <Route path="/task-definitions/:family/:revision" element={<TaskDefDetail />} />
                <Route path="/task-definitions/:family/:revision/edit" element={<TaskDefEditor />} />
                <Route path="/logs" element={<Logs />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
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
        <EventStreamProvider>
          <Toaster />
          <Sonner />
          <Router>
            <AppLayout />
          </Router>
          {isDev && <ReactQueryDevtools initialIsOpen={false} />}
        </EventStreamProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
