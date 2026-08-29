import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useTaskDefFamilies } from "@/api/task-definitions";
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

export function TaskDefFamilies() {
  const { data, isLoading, isError, error } = useTaskDefFamilies();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Task definitions</h1>
          <p className="text-sm text-muted-foreground">
            Grouped by family. Each register creates a new immutable revision.
          </p>
        </div>
        <Button asChild>
          <Link to="/task-definitions/new">
            <Plus className="size-4" />
            Register
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingRows />
          ) : isError ? (
            <div className="p-4">
              <ErrorState error={error} title="Couldn't load task definitions" />
            </div>
          ) : !data || data.length === 0 ? (
            <EmptyState>No task definitions registered yet.</EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Family</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Latest revision</TableHead>
                  <TableHead className="text-right">Active revisions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((f) => (
                  <TableRow key={f.family}>
                    <TableCell className="font-medium">
                      <Link className="hover:underline" to={`/task-definitions/${f.family}`}>
                        {f.family}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={f.status} kind="service" />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {f.latestRevision ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{f.activeRevisions}</TableCell>
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
