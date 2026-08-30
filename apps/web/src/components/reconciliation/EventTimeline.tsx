import type { ChangeEvent, ChangeEventType } from "@ecs-local-console/shared";
import {
  CheckCircle2,
  Pencil,
  Play,
  RefreshCw,
  Square,
  type LucideIcon,
} from "lucide-react";
import { InfoHint } from "@/components/InfoHint";
import { EmptyState } from "@/components/States";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const ICONS: Record<ChangeEventType, LucideIcon> = {
  "task.started": Play,
  "task.stopped": Square,
  "task.replaced-by-scheduler": RefreshCw,
  "service.deployment.completed": CheckCircle2,
  "service.changed": Pencil,
};

function toneFor(e: ChangeEvent): string {
  if (e.type === "task.stopped") {
    return e.severity === "error" ? "text-destructive" : "text-muted-foreground";
  }
  if (e.type === "task.replaced-by-scheduler") return "text-accent-foreground";
  if (e.type === "service.changed") return "text-foreground";
  return "text-success";
}

function labelFor(e: ChangeEvent): string {
  const id = e.resource.slice(0, 12);
  switch (e.type) {
    case "task.started":
      return `Task ${id} started`;
    case "task.stopped":
      return e.severity === "error"
        ? `Task ${id} stopped — ${e.detail ?? "error"}`
        : `Task ${id} stopped${e.detail && !e.detail.startsWith(id) ? ` (${e.detail})` : ""}`;
    case "task.replaced-by-scheduler":
      return `Scheduler replaced task ${id}`;
    case "service.deployment.completed":
      return `Deployment ${e.detail ?? "completed"}`;
    case "service.changed":
      return e.detail ?? `${e.resource} changed`;
  }
}

export function EventTimeline({
  events,
  live,
}: {
  events: ChangeEvent[];
  live: boolean;
}) {
  if (events.length === 0) {
    return (
      <EmptyState>
        {live
          ? "No changes yet. Scale the service or push a new revision to watch the scheduler react."
          : "Live events unavailable — showing polled state only."}
      </EmptyState>
    );
  }

  return (
    <ol className="relative space-y-3 border-l pl-5">
      {events.map((e) => {
        const Icon = ICONS[e.type];
        return (
          <li
            key={e.id}
            className="relative animate-in fade-in slide-in-from-top-2 duration-300"
          >
            <span
              className={cn(
                "absolute -left-[27px] flex size-4 items-center justify-center rounded-full bg-background",
                toneFor(e),
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm">
                {labelFor(e)}
                {e.type === "task.replaced-by-scheduler" && (
                  <InfoHint hint="SCHEDULER_REPLACED_TASK" className="ml-1" />
                )}
                {e.type === "service.deployment.completed" && (
                  <InfoHint hint="DEPLOYMENT_COMPLETED" className="ml-1" />
                )}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {relativeTime(e.ts)}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
