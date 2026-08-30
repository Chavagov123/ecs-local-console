import { ArrowLeft, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCluster, useDeleteCluster } from "@/api/clusters";
import { useServices } from "@/api/services";
import { useClusterTasks } from "@/api/tasks";
import { InfoHint } from "@/components/InfoHint";
import { CreateServiceDialog } from "@/components/services/CreateServiceDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState, ErrorState, LoadingRows } from "@/components/States";
import { RunTaskDialog } from "@/components/tasks/RunTaskDialog";
import { TaskTable } from "@/components/TaskTable";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutationToast } from "@/lib/mutation-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { taskDefLabel } from "@/lib/format";

function DeleteClusterButton({ cluster }: { cluster: string }) {
  const del = useMutationToast(useDeleteCluster(), { success: `Cluster "${cluster}" deleted` });
  const navigate = useNavigate();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Trash2 className="size-4" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete cluster &ldquo;{cluster}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            ECS refuses this if the cluster still has active services or running tasks.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => del.run(cluster).then(() => navigate("/clusters")).catch(() => {})}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ServicesTab({ cluster }: { cluster: string }) {
  const { data, isLoading, isError, error } = useServices(cluster);
  if (isLoading) return <LoadingRows />;
  if (isError) return <ErrorState error={error} title="Couldn't load services" />;
  if (!data || data.length === 0)
    return <EmptyState>No services in this cluster.</EmptyState>;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Task definition</TableHead>
          <TableHead className="text-right">Desired</TableHead>
          <TableHead className="text-right">Running</TableHead>
          <TableHead className="text-right">Pending</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((s) => (
          <TableRow key={s.arn || s.name}>
            <TableCell className="font-medium">
              <Link className="hover:underline" to={`/clusters/${cluster}/services/${s.name}`}>
                {s.name}
              </Link>
            </TableCell>
            <TableCell>
              <span className="flex items-center gap-1.5">
                <StatusBadge status={s.status} kind="service" />
                {s.deploymentInProgress && (
                  <>
                    <StatusBadge status="IN_PROGRESS" kind="deployment" pulse />
                    <InfoHint hint="DEPLOYMENT_IN_PROGRESS" />
                  </>
                )}
              </span>
            </TableCell>
            <TableCell className="font-mono text-xs">{taskDefLabel(s.taskDefinition)}</TableCell>
            <TableCell className="text-right tabular-nums">{s.desiredCount}</TableCell>
            <TableCell className="text-right tabular-nums">{s.runningCount}</TableCell>
            <TableCell className="text-right tabular-nums">{s.pendingCount}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TasksTab({ cluster }: { cluster: string }) {
  const [showStopped, setShowStopped] = useState(false);
  const { data, isLoading, isError, error } = useClusterTasks(
    cluster,
    showStopped ? {} : { desiredStatus: "RUNNING" },
  );
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setShowStopped((v) => !v)}>
          {showStopped ? "Hide stopped" : "Show stopped"}
        </Button>
      </div>
      {isLoading ? (
        <LoadingRows />
      ) : isError ? (
        <ErrorState error={error} title="Couldn't load tasks" />
      ) : !data || data.length === 0 ? (
        <EmptyState>No tasks.</EmptyState>
      ) : (
        <TaskTable cluster={cluster} tasks={data} />
      )}
    </div>
  );
}

export function ClusterDetail() {
  const { cluster = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "services";
  const { data, isLoading, isError, error } = useCluster(cluster);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
          <Link to="/clusters">
            <ArrowLeft className="size-4" />
            Clusters
          </Link>
        </Button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{cluster}</h1>
            {data && <StatusBadge status={data.status} kind="service" />}
          </div>
          <DeleteClusterButton cluster={cluster} />
        </div>
      </div>

      {isError && <ErrorState error={error} title="Couldn't load cluster" />}

      {isLoading ? (
        <LoadingRows rows={2} />
      ) : data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Services" value={data.activeServicesCount} />
          <Stat label="Running tasks" value={data.runningTasksCount} />
          <Stat label="Pending tasks" value={data.pendingTasksCount} />
          <Stat
            label="Container instances"
            value={data.registeredContainerInstancesCount}
            to={`/clusters/${cluster}/container-instances`}
          />
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
          </TabsList>
          {tab === "services" ? (
            <CreateServiceDialog cluster={cluster} />
          ) : (
            <RunTaskDialog cluster={cluster} />
          )}
        </div>
        <TabsContent value="services" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <ServicesTab cluster={cluster} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="tasks" className="mt-4">
          <TasksTab cluster={cluster} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, to }: { label: string; value: number; to?: string }) {
  const body = (
    <CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </CardContent>
  );
  return to ? (
    <Link to={to} className="block">
      <Card className="h-full transition-colors hover:border-ring">{body}</Card>
    </Link>
  ) : (
    <Card>{body}</Card>
  );
}
