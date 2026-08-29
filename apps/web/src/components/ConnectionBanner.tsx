import { AlertTriangle, Loader2, Wifi } from "lucide-react";
import { Link } from "react-router-dom";
import { useHealth } from "@/api/health";
import { cn } from "@/lib/utils";

/**
 * Full-width banner shown when the configured AWS endpoint is unreachable or ECS
 * isn't answering. Silent when everything is healthy.
 */
export function ConnectionBanner() {
  const { data, isLoading, isError } = useHealth();

  if (isLoading) return null;

  if (isError || !data?.reachable) {
    return (
      <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
        <AlertTriangle className="size-4 shrink-0" />
        <span>
          Can&apos;t reach the AWS endpoint{data?.endpoint ? ` at ${data.endpoint}` : ""}.
          {" "}Start LocalStack (<code className="font-mono">pnpm dev:stack</code>) or point at a
          different endpoint in <Link to="/settings" className="underline">Settings</Link>.
        </span>
      </div>
    );
  }

  if (!data.ecsAvailable) {
    return (
      <div className="flex items-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning-foreground">
        <AlertTriangle className="size-4 shrink-0" />
        <span>
          Connected to {data.endpoint}, but the ECS API returned an error
          {data.detail ? `: ${data.detail}` : "."}
        </span>
      </div>
    );
  }

  return null;
}

/** Compact connection pill for the header. */
export function ConnectionPill() {
  const { data, isLoading } = useHealth();
  const ok = data?.reachable && data?.ecsAvailable;
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        isLoading && "text-muted-foreground",
        !isLoading && ok && "border-success/30 bg-success/10 text-success",
        !isLoading && !ok && "border-destructive/30 bg-destructive/10 text-destructive",
      )}
      title={data?.endpoint}
    >
      {isLoading ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Wifi className="size-3" />
      )}
      <span className="max-w-[16rem] truncate">
        {data?.endpoint ?? "connecting…"}
      </span>
      {data?.flavor && data.flavor !== "unknown" && (
        <span className="text-muted-foreground">· {data.flavor}</span>
      )}
    </div>
  );
}
