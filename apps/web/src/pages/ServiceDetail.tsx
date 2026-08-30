import { ArrowLeft } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useService, useServiceTasks } from "@/api/services";
import { InfoHint } from "@/components/InfoHint";
import { ReconciliationPanel } from "@/components/reconciliation/ReconciliationPanel";
import { ServiceActions } from "@/components/services/ServiceActions";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState, ErrorState, LoadingRows } from "@/components/States";
import { TaskTable } from "@/components/TaskTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { absoluteTime, relativeTime, taskDefLabel } from "@/lib/format";

export function ServiceDetail() {
  const { cluster = "", service = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "overview";
  const { data, isLoading, isError, error } = useService(cluster, service);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
          <Link to={`/clusters/${cluster}?tab=services`}>
            <ArrowLeft className="size-4" />
            {cluster}
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{service}</h1>
            {data && <StatusBadge status={data.status} kind="service" />}
            {data?.deploymentInProgress && (
              <span className="flex items-center gap-1">
                <StatusBadge status="IN_PROGRESS" kind="deployment" pulse />
                <InfoHint hint="DEPLOYMENT_IN_PROGRESS" />
              </span>
            )}
          </div>
          {data && <ServiceActions svc={data} />}
        </div>
      </div>

      {isError && <ErrorState error={error} title="Couldn't load service" />}
      {isLoading && <LoadingRows rows={3} />}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Desired"
              value={data.desiredCount}
              hint="DESIRED_COUNT"
            />
            <Stat label="Running" value={data.runningCount} />
            <Stat label="Pending" value={data.pendingCount} />
            <Stat label="Deployments" value={data.deployments.length} />
          </div>

          <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
              <TabsTrigger value="deployments">Deployments</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <Card>
                <CardContent className="space-y-2 p-4 text-sm">
                  <Field label="Task definition" value={taskDefLabel(data.taskDefinition)} mono />
                  <Field label="Launch type" value={data.launchType ?? "—"} />
                  <Field label="Scheduling strategy" value={data.schedulingStrategy ?? "—"} />
                  <Field
                    label="Network mode"
                    value={
                      data.networkConfiguration?.awsvpcConfiguration
                        ? "awsvpc"
                        : "bridge / host"
                    }
                  />
                  {data.networkConfiguration?.awsvpcConfiguration && (
                    <>
                      <Field
                        label="Subnets"
                        value={data.networkConfiguration.awsvpcConfiguration.subnets.join(", ") || "—"}
                        mono
                      />
                      <Field
                        label="Security groups"
                        value={
                          data.networkConfiguration.awsvpcConfiguration.securityGroups.join(", ") ||
                          "—"
                        }
                        mono
                      />
                    </>
                  )}
                  {data.deploymentConfiguration?.deploymentCircuitBreaker?.enable && (
                    <Field
                      label="Circuit breaker"
                      value={
                        data.deploymentConfiguration.deploymentCircuitBreaker.rollback
                          ? "enabled, auto-rollback"
                          : "enabled"
                      }
                    />
                  )}
                  <Field label="Created" value={absoluteTime(data.createdAt)} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reconciliation" className="mt-4">
              <ReconciliationPanel cluster={cluster} service={service} />
            </TabsContent>

            <TabsContent value="deployments" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Rollout</TableHead>
                        <TableHead>Task definition</TableHead>
                        <TableHead className="text-right">Desired</TableHead>
                        <TableHead className="text-right">Running</TableHead>
                        <TableHead className="text-right">Failed</TableHead>
                        <TableHead>Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.deployments.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="text-xs font-medium">{d.status}</TableCell>
                          <TableCell>
                            {d.rolloutState ? (
                              <span className="flex items-center gap-1">
                                <StatusBadge
                                  status={d.rolloutState}
                                  kind="deployment"
                                  pulse={d.rolloutState === "IN_PROGRESS"}
                                />
                                {d.rolloutStateReason && <InfoHint text={d.rolloutStateReason} />}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {taskDefLabel(d.taskDefinition)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{d.desiredCount}</TableCell>
                          <TableCell className="text-right tabular-nums">{d.runningCount}</TableCell>
                          <TableCell className="text-right tabular-nums">{d.failedTasks}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {relativeTime(d.updatedAt ?? d.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="events" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  {data.events.length === 0 ? (
                    <EmptyState>No recent events.</EmptyState>
                  ) : (
                    <ol className="space-y-2 text-sm">
                      {data.events.map((e) => (
                        <li key={e.id} className="flex gap-3">
                          <span className="w-20 shrink-0 text-xs text-muted-foreground">
                            {relativeTime(e.createdAt)}
                          </span>
                          <span>{e.message}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tasks" className="mt-4">
              <ServiceTasks cluster={cluster} service={service} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function ServiceTasks({ cluster, service }: { cluster: string; service: string }) {
  const { data, isLoading, isError, error } = useServiceTasks(cluster, service);
  if (isLoading) return <LoadingRows />;
  if (isError) return <ErrorState error={error} title="Couldn't load tasks" />;
  if (!data || data.length === 0) return <EmptyState>No tasks for this service.</EmptyState>;
  return (
    <Card>
      <CardContent className="p-0">
        <TaskTable cluster={cluster} tasks={data} />
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: Parameters<typeof InfoHint>[0]["hint"];
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          {label}
          {hint && <InfoHint hint={hint} />}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{value}</span>
    </div>
  );
}
