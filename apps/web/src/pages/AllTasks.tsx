import { useState } from "react";
import { useAllTasks, type TaskFilters } from "@/api/tasks";
import { EmptyState, ErrorState, LoadingRows } from "@/components/States";
import { TaskTable } from "@/components/TaskTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const FILTERS: { label: string; value: TaskFilters }[] = [
  { label: "Running", value: { desiredStatus: "RUNNING" } },
  { label: "Pending", value: { desiredStatus: "PENDING" } },
  { label: "Stopped", value: { desiredStatus: "STOPPED" } },
  { label: "All", value: {} },
];

export function AllTasks() {
  const [idx, setIdx] = useState(0);
  const filter = FILTERS[idx]!.value;
  const { data, isLoading, isError, error } = useAllTasks(filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">Every task across all clusters.</p>
        </div>
        <div className="flex gap-1">
          {FILTERS.map((f, i) => (
            <Button
              key={f.label}
              size="sm"
              variant={i === idx ? "default" : "outline"}
              onClick={() => setIdx(i)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingRows />
          ) : isError ? (
            <div className="p-4">
              <ErrorState error={error} title="Couldn't load tasks" />
            </div>
          ) : !data || data.length === 0 ? (
            <EmptyState>No tasks match this filter.</EmptyState>
          ) : (
            <TaskTable tasks={data} showCluster />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
