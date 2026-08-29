import type { ClusterSummary } from "@ecs-local-console/shared";
import { Activity, Boxes, Layers, Plus, Server } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import type { ApiError } from "@/api/client";
import { useClusters, useCreateCluster } from "@/api/clusters";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function sum(rows: ClusterSummary[], pick: (c: ClusterSummary) => number): number {
  return rows.reduce((acc, c) => acc + pick(c), 0);
}

function CreateClusterDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const create = useCreateCluster();

  async function submit() {
    try {
      await create.mutateAsync({ clusterName: name.trim() });
      toast.success(`Cluster "${name.trim()}" created`);
      setOpen(false);
      setName("");
    } catch (err) {
      const e = err as ApiError;
      toast.error(e.message, { description: e.hint });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Create cluster
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create cluster</DialogTitle>
          <DialogDescription>
            An ECS cluster is just a namespace for services and tasks — no capacity to
            provision when running on LocalStack or Fargate.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cluster-name">Cluster name</Label>
          <Input
            id="cluster-name"
            value={name}
            autoFocus
            placeholder="my-cluster"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name.trim() && submit()}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || create.isPending}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ClustersList() {
  const { data, isLoading, isError, error } = useClusters();
  const clusters = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clusters</h1>
          <p className="text-sm text-muted-foreground">
            Every ECS cluster at the connected endpoint.
          </p>
        </div>
        <CreateClusterDialog />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Clusters" value={clusters.length} icon={Server} />
        <MetricCard
          title="Running tasks"
          value={sum(clusters, (c) => c.runningTasksCount)}
          icon={Boxes}
          trend={`${sum(clusters, (c) => c.pendingTasksCount)} pending`}
        />
        <MetricCard
          title="Active services"
          value={sum(clusters, (c) => c.activeServicesCount)}
          icon={Layers}
        />
        <MetricCard
          title="Container instances"
          value={sum(clusters, (c) => c.registeredContainerInstancesCount)}
          icon={Activity}
        />
      </div>

      {isError && (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t load clusters</AlertTitle>
          <AlertDescription>
            {(error as ApiError)?.message}
            {(error as ApiError)?.hint && (
              <span className="mt-1 block text-xs opacity-80">{(error as ApiError).hint}</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : clusters.length === 0 && !isError ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No clusters yet. Create one above, or run{" "}
              <code className="font-mono">
                aws --endpoint-url=… ecs create-cluster --cluster-name demo
              </code>
              .
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Services</TableHead>
                  <TableHead className="text-right">Running</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clusters.map((c) => (
                  <TableRow key={c.arn || c.name}>
                    <TableCell className="font-medium">
                      <Link className="hover:underline" to={`/clusters/${c.name}`}>
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.status} kind="service" />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.activeServicesCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.runningTasksCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.pendingTasksCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
