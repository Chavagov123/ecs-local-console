import type { ServiceDetail, ServiceSnapshot } from "@ecs-local-console/shared";
import { Radio } from "lucide-react";
import { useService } from "@/api/services";
import {
  useEventStream,
  useRegisterEventClusters,
} from "@/components/events/EventStreamProvider";
import { InfoHint } from "@/components/InfoHint";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DesiredVsRunningGauge } from "./DesiredVsRunningGauge";
import { EventTimeline } from "./EventTimeline";

/** Merge the authoritative polled detail with the (usually fresher) SSE snapshot. */
function mergeCounts(detail: ServiceDetail, snap: ServiceSnapshot | undefined) {
  if (!snap) {
    return {
      desired: detail.desiredCount,
      running: detail.runningCount,
      pending: detail.pendingCount,
      deployments: detail.deployments.map((d) => ({
        id: d.id,
        taskDefinition: d.taskDefinition,
        status: d.status,
        rolloutState: d.rolloutState,
        desired: d.desiredCount,
        running: d.runningCount,
        pending: d.pendingCount,
      })),
    };
  }
  return {
    desired: snap.desired,
    running: snap.running,
    pending: snap.pending,
    deployments: snap.deployments,
  };
}

export function ReconciliationPanel({
  cluster,
  service,
}: {
  cluster: string;
  service: string;
}) {
  useRegisterEventClusters([cluster]);
  const { status, events, snapshot } = useEventStream();
  const { data: detail } = useService(cluster, service);

  const live = status === "open";
  const snap = snapshot(cluster)?.services.find((s) => s.service === service);
  const counts = detail ? mergeCounts(detail, snap) : undefined;

  const primary =
    counts?.deployments.find((d) => d.status === "PRIMARY") ?? counts?.deployments[0];
  const inProgress = primary?.rolloutState === "IN_PROGRESS";

  const serviceEvents = events(cluster).filter(
    (e) => e.service === service || e.resource === service,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
            live
              ? "border-success/30 bg-success/10 text-success"
              : "border-warning/30 bg-warning/10 text-warning-foreground",
          )}
        >
          <Radio className={cn("size-3", live && "animate-pulse")} />
          {live ? "live" : "polling every few seconds"}
        </span>
        <InfoHint hint="EVENT_STREAM_LIVE" />
      </div>

      <Card>
        <CardContent className="p-4">
          {counts ? (
            <DesiredVsRunningGauge
              desired={counts.desired}
              running={counts.running}
              pending={counts.pending}
              deployments={counts.deployments}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Loading counts…</p>
          )}
        </CardContent>
      </Card>

      {primary?.rolloutState && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge
            status={primary.rolloutState}
            kind="deployment"
            pulse={inProgress}
          />
          {detail?.deployments.find((d) => d.status === "PRIMARY")?.rolloutStateReason && (
            <span className="text-muted-foreground">
              {detail.deployments.find((d) => d.status === "PRIMARY")?.rolloutStateReason}
            </span>
          )}
          {detail?.deploymentConfiguration?.deploymentCircuitBreaker?.enable && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              circuit breaker{" "}
              {detail.deploymentConfiguration.deploymentCircuitBreaker.rollback
                ? "+ rollback"
                : ""}
            </span>
          )}
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <EventTimeline events={serviceEvents} live={live} />
        </CardContent>
      </Card>
    </div>
  );
}
