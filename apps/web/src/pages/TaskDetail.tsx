import { ArrowLeft } from "lucide-react";
import { Fragment } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTaskEnis, useTaskLogConfig } from "@/api/logs";
import { useTask } from "@/api/tasks";
import { InfoHint } from "@/components/InfoHint";
import { LogViewer } from "@/components/logs/LogViewer";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState, ErrorState, LoadingRows } from "@/components/States";
import { StopTaskButton } from "@/components/tasks/StopTaskButton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { absoluteTime, taskDefLabel } from "@/lib/format";

export function TaskDetail() {
  const { cluster = "", taskId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "containers";
  const { data, isLoading, isError, error } = useTask(cluster, taskId);

  const awsvpc = data?.attachments.some((a) => a.type === "ElasticNetworkInterface");

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
          <Link to={`/clusters/${cluster}?tab=tasks`}>
            <ArrowLeft className="size-4" />
            {cluster}
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-xl font-semibold">{taskId.slice(0, 20)}</h1>
            {data && (
              <StatusBadge status={data.lastStatus} kind="task" pulse={data.transitioning} />
            )}
            {data?.transitioning && (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                → {data.desiredStatus}
                <InfoHint
                  hint={data.desiredStatus === "RUNNING" ? "PROVISIONING" : "DEPROVISIONING"}
                />
              </span>
            )}
          </div>
          {data && data.lastStatus !== "STOPPED" && (
            <StopTaskButton cluster={cluster} taskId={taskId} />
          )}
        </div>
      </div>

      {isError && <ErrorState error={error} title="Couldn't load task" />}
      {isLoading && <LoadingRows rows={3} />}

      {data && (
        <>
          {data.stoppedReason && (
            <Alert variant={data.lastStatus === "STOPPED" ? "destructive" : "default"}>
              <AlertTitle>Stopped reason</AlertTitle>
              <AlertDescription>{data.stoppedReason}</AlertDescription>
            </Alert>
          )}

          <Card>
            <CardContent className="grid gap-2 p-4 text-sm sm:grid-cols-2">
              <Field label="Task definition" value={taskDefLabel(data.taskDefinition)} mono />
              <Field label="Launch type" value={data.launchType ?? "—"} />
              <Field label="CPU / memory" value={`${data.cpu ?? "—"} / ${data.memory ?? "—"}`} />
              <Field label="Started by" value={data.startedBy ?? "—"} mono />
              <Field label="Created" value={absoluteTime(data.createdAt)} />
              <Field label="Started" value={absoluteTime(data.startedAt)} />
              <Field
                label="Network mode"
                value={awsvpc ? "awsvpc" : "bridge / host"}
              />
              <Field label="Connectivity" value={data.connectivity ?? "—"} />
            </CardContent>
          </Card>

          <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
            <TabsList>
              <TabsTrigger value="containers">Containers</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="network">Network</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>

            <TabsContent value="containers" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Image</TableHead>
                        <TableHead>Ports</TableHead>
                        <TableHead className="text-right">Exit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.containers.map((c) => (
                        <TableRow key={c.name}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1.5">
                              <StatusBadge status={c.lastStatus} kind="task" />
                              {c.reason && <InfoHint text={c.reason} />}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{c.image ?? "—"}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {c.networkBindings.length === 0
                              ? "—"
                              : c.networkBindings
                                  .map(
                                    (n) =>
                                      `${n.hostPort ?? "?"}:${n.containerPort ?? "?"}/${n.protocol ?? "tcp"}`,
                                  )
                                  .join("  ")}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {c.exitCode ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="logs" className="mt-4">
              <TaskLogsTab cluster={cluster} taskId={taskId} />
            </TabsContent>

            <TabsContent value="network" className="mt-4">
              <TaskNetworkTab
                cluster={cluster}
                taskId={taskId}
                awsvpc={!!awsvpc}
                attachments={data.attachments}
              />
            </TabsContent>

            <TabsContent value="json" className="mt-4">
              <Card>
                <CardContent className="p-0">
                  <pre className="max-h-[32rem] overflow-auto p-4 text-xs">
                    {JSON.stringify(data, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function TaskLogsTab({ cluster, taskId }: { cluster: string; taskId: string }) {
  const { data, isLoading, isError, error } = useTaskLogConfig(cluster, taskId);
  if (isLoading) return <LoadingRows rows={3} />;
  if (isError) return <ErrorState error={error} title="Couldn't resolve log config" />;
  if (!data || data.containers.length === 0)
    return <EmptyState>No containers on this task.</EmptyState>;

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={data.containers.find((c) => c.logDriver === "awslogs")?.container}
    >
      {data.containers.map((c) => (
        <AccordionItem key={c.container} value={c.container}>
          <AccordionTrigger className="text-sm">
            <span className="flex items-center gap-2">
              {c.container}
              <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">
                {c.logDriver}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            {c.logDriver === "awslogs" && c.awslogsGroup ? (
              <LogViewer logGroup={c.awslogsGroup} logStream={c.computedStream} />
            ) : (
              <Alert>
                <AlertTitle>Not in CloudWatch Logs</AlertTitle>
                <AlertDescription className="flex items-center gap-1">
                  {c.hint ?? "This container doesn't use the awslogs driver."}
                  <InfoHint hint="LOG_DRIVER_NON_AWSLOGS" />
                </AlertDescription>
              </Alert>
            )}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function TaskNetworkTab({
  cluster,
  taskId,
  awsvpc,
  attachments,
}: {
  cluster: string;
  taskId: string;
  awsvpc: boolean;
  attachments: { id?: string; type?: string; status?: string; details: Record<string, string> }[];
}) {
  const { data: enis } = useTaskEnis(cluster, taskId, awsvpc);

  return (
    <Card>
      <CardContent className="space-y-3 p-4 text-sm">
        <p className="flex items-center gap-1 text-muted-foreground">
          {awsvpc ? "awsvpc mode" : "bridge / host mode"}
          <InfoHint hint={awsvpc ? "NETWORK_MODE_AWSVPC" : "NETWORK_MODE_BRIDGE"} />
        </p>

        {enis && enis.length > 0
          ? enis.map((eni) => (
              <div key={eni.networkInterfaceId} className="rounded border p-3">
                <p className="font-mono text-xs font-medium">{eni.networkInterfaceId}</p>
                <dl className="mt-1 grid grid-cols-[9rem_1fr] gap-x-2 gap-y-0.5 font-mono text-xs">
                  <dt className="text-muted-foreground">Private IP</dt>
                  <dd>{eni.privateIpAddress ?? "—"}</dd>
                  <dt className="text-muted-foreground">Private DNS</dt>
                  <dd className="break-all">{eni.privateDnsName ?? "—"}</dd>
                  {eni.publicIp && (
                    <>
                      <dt className="text-muted-foreground">Public IP</dt>
                      <dd>{eni.publicIp}</dd>
                    </>
                  )}
                  <dt className="text-muted-foreground">Subnet</dt>
                  <dd>{eni.subnetId ?? "—"}</dd>
                  <dt className="text-muted-foreground">VPC</dt>
                  <dd>{eni.vpcId ?? "—"}</dd>
                  <dt className="text-muted-foreground">AZ</dt>
                  <dd>{eni.availabilityZone ?? "—"}</dd>
                  <dt className="text-muted-foreground">Security groups</dt>
                  <dd>{eni.securityGroups.map((g) => g.groupId).join(", ") || "—"}</dd>
                </dl>
              </div>
            ))
          : null}

        {(!enis || enis.length === 0) && attachments.length === 0 && (
          <p className="text-muted-foreground">
            No ENI attachments — this task uses host networking.
          </p>
        )}

        {(!enis || enis.length === 0) &&
          attachments.map((a) => (
            <div key={a.id} className="rounded border p-3">
              <p className="text-xs font-medium">
                {a.type} · {a.status}
              </p>
              <dl className="mt-1 grid grid-cols-[10rem_1fr] gap-x-2 font-mono text-xs">
                {Object.entries(a.details).map(([k, v]) => (
                  <Fragment key={k}>
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd>{v}</dd>
                  </Fragment>
                ))}
              </dl>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "truncate font-mono text-xs" : ""}>{value}</span>
    </div>
  );
}
