import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useContainerInstances } from "@/api/logs";
import { InfoHint } from "@/components/InfoHint";
import { EmptyState, ErrorState, LoadingRows } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { relativeTime } from "@/lib/format";

export function ContainerInstances() {
  const { cluster = "" } = useParams();
  const { data, isLoading, isError, error } = useContainerInstances(cluster);

  return (
    <div className="space-y-4">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
          <Link to={`/clusters/${cluster}`}>
            <ArrowLeft className="size-4" />
            {cluster}
          </Link>
        </Button>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          Container instances
          <InfoHint hint="NO_CONTAINER_INSTANCES" />
        </h1>
      </div>

      {isError && <ErrorState error={error} title="Couldn't load container instances" />}
      {isLoading && <LoadingRows rows={3} />}

      {data && data.length === 0 && (
        <EmptyState>
          No registered EC2 container instances — expected for Fargate / LocalStack clusters.
        </EmptyState>
      )}

      {data && data.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instance</TableHead>
                  <TableHead>EC2 id</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-right">Running</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((ci) => (
                  <TableRow key={ci.containerInstanceId}>
                    <TableCell className="font-mono text-xs">
                      {ci.containerInstanceId.slice(0, 12)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{ci.ec2InstanceId ?? "—"}</TableCell>
                    <TableCell className="text-xs font-medium">{ci.status}</TableCell>
                    <TableCell className="text-xs">
                      {ci.agentConnected ? "connected" : "disconnected"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{ci.runningTasksCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{ci.pendingTasksCount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {relativeTime(ci.registeredAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
