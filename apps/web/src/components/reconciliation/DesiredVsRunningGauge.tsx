import type { SnapshotDeployment } from "@ecs-local-console/shared";
import { InfoHint } from "@/components/InfoHint";
import { cn } from "@/lib/utils";

interface Counts {
  desired: number;
  running: number;
  pending: number;
}

/**
 * Horizontal stacked bar: running (solid) + pending (striped) + the gap still to
 * fill (dashed) — and, during a blue/green rollout, any surplus tasks. Widths
 * animate so a scale or deploy visibly "fills in". No chart library.
 */
export function DesiredVsRunningGauge({
  desired,
  running,
  pending,
  deployments,
}: Counts & { deployments?: SnapshotDeployment[] }) {
  const showPerDeployment = (deployments?.length ?? 0) > 1;

  return (
    <div className="space-y-3" data-testid="recon-gauge">
      <Bar desired={desired} running={running} pending={pending} tall />
      <div className="flex items-baseline justify-between text-sm">
        <span className="tabular-nums">
          <span className="text-lg font-semibold">{running}</span>
          <span className="text-muted-foreground"> / {desired} running</span>
        </span>
        {pending > 0 && (
          <span className="text-xs text-warning-foreground">{pending} pending</span>
        )}
      </div>

      {showPerDeployment && (
        <div className="space-y-2 border-t pt-3">
          {deployments!.map((d) => (
            <div key={d.id} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="font-mono">
                  {d.taskDefinition}
                  <span className="ml-1.5 rounded bg-muted px-1 text-muted-foreground">
                    {d.status}
                  </span>
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {d.running} / {d.desired}
                </span>
              </div>
              <Bar desired={d.desired} running={d.running} pending={d.pending} />
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <Legend className="bg-success" label="running" />
        <Legend className="bg-warning" label="pending" striped />
        <Legend className="border border-dashed border-muted-foreground/50" label="to start" />
        <InfoHint hint="RECONCILIATION_GAUGE" />
      </div>
    </div>
  );
}

function Bar({ desired, running, pending, tall }: Counts & { tall?: boolean }) {
  const total = Math.max(desired, running + pending, 1);
  const pct = (n: number) => `${(Math.max(0, n) / total) * 100}%`;
  const missing = Math.max(0, desired - running - pending);
  const surplus = Math.max(0, running - desired);

  return (
    <div
      className={cn(
        "flex w-full overflow-hidden rounded-md bg-muted/40",
        tall ? "h-6" : "h-3",
      )}
      role="img"
      aria-label={`${running} running, ${pending} pending, of ${desired} desired`}
    >
      <Segment className="bg-success" width={pct(Math.min(running, desired))} testid="seg-running" />
      {surplus > 0 && (
        <Segment className="bg-accent" width={pct(surplus)} testid="seg-surplus" />
      )}
      <Segment
        className="bg-warning [background-image:repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.15)_4px,rgba(0,0,0,0.15)_8px)]"
        width={pct(pending)}
        pulse
        testid="seg-pending"
      />
      <Segment
        className="border-y border-r border-dashed border-muted-foreground/40"
        width={pct(missing)}
        testid="seg-missing"
      />
    </div>
  );
}

function Segment({
  className,
  width,
  pulse,
  testid,
}: {
  className: string;
  width: string;
  pulse?: boolean;
  testid: string;
}) {
  return (
    <div
      data-testid={testid}
      data-width={width}
      className={cn("h-full transition-[width] duration-700 ease-out", pulse && "animate-pulse", className)}
      style={{ width }}
    />
  );
}

function Legend({
  className,
  label,
  striped,
}: {
  className: string;
  label: string;
  striped?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={cn(
          "inline-block size-2.5 rounded-sm",
          className,
          striped &&
            "[background-image:repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(0,0,0,0.2)_2px,rgba(0,0,0,0.2)_4px)]",
        )}
      />
      {label}
    </span>
  );
}
