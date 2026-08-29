import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useTaskDefRevisions } from "@/api/task-definitions";
import { StatusBadge } from "@/components/StatusBadge";
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

export function TaskDefRevisions() {
  const { family = "" } = useParams();
  const { data, isLoading, isError, error } = useTaskDefRevisions(family);

  return (
    <div className="space-y-4">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
          <Link to="/task-definitions">
            <ArrowLeft className="size-4" />
            Task definitions
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{family}</h1>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingRows />
          ) : isError ? (
            <div className="p-4">
              <ErrorState error={error} />
            </div>
          ) : !data || data.length === 0 ? (
            <EmptyState>No revisions.</EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Revision</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Launch</TableHead>
                  <TableHead>CPU / mem</TableHead>
                  <TableHead>Containers</TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((r) => (
                  <TableRow key={r.revision}>
                    <TableCell className="font-medium">
                      <Link
                        className="hover:underline"
                        to={`/task-definitions/${family}/${r.revision}`}
                      >
                        {family}:{r.revision}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} kind="service" />
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.requiresCompatibilities.join(", ") || "EC2"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.cpu ?? "—"} / {r.memory ?? "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.containerNames.join(", ")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {relativeTime(r.registeredAt)}
                    </TableCell>
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
