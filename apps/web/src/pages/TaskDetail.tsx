import { ArrowLeft } from "lucide-react";
import { Fragment } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTask } from "@/api/tasks";
import { InfoHint } from "@/components/InfoHint";
import { StatusBadge } from "@/components/StatusBadge";
import { ErrorState, LoadingRows } from "@/components/States";
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
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-xl font-semibold">{taskId.slice(0, 20)}</h1>
          {data && (
            <StatusBadge status={data.lastStatus} kind="task" pulse={data.transitioning} />
          )}
          {data?.transitioning && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              → {data.desiredStatus}
              <InfoHint
                hint={
                  data.desiredStatus === "RUNNING"
                    ? "PROVISIONING"
                    : "DEPROVISIONING"
                }
              />
            </span>
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

            <TabsContent value="network" className="mt-4">
              <Card>
                <CardContent className="space-y-3 p-4 text-sm">
                  <p className="flex items-center gap-1 text-muted-foreground">
                    {awsvpc ? "awsvpc mode" : "bridge / host mode"}
                    <InfoHint hint={awsvpc ? "NETWORK_MODE_AWSVPC" : "NETWORK_MODE_BRIDGE"} />
                  </p>
                  {data.attachments.length === 0 && (
                    <p className="text-muted-foreground">
                      No ENI attachments — this task uses host networking.
                    </p>
                  )}
                  {data.attachments.map((a) => (
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

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "truncate font-mono text-xs" : ""}>{value}</span>
    </div>
  );
}
