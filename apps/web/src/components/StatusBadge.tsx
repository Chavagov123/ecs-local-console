import { type StatusKind, type StatusTone, statusTone } from "@ecs-local-console/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<StatusTone, string> = {
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  info: "bg-primary/15 text-primary border-primary/30",
  muted: "bg-muted text-muted-foreground border-border",
};

interface StatusBadgeProps {
  status: string | undefined | null;
  /** Which ECS vocabulary to interpret `status` against. Defaults to task states. */
  kind?: StatusKind;
  /** Add a subtle pulse — used for in-progress deployments / transitioning tasks. */
  pulse?: boolean;
  className?: string;
}

/** Title-cases an ECS SCREAMING_SNAKE status for display. */
function label(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function StatusBadge({ status, kind = "task", pulse, className }: StatusBadgeProps) {
  const raw = status?.trim() || "UNKNOWN";
  const tone = statusTone(raw, kind);
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        TONE_CLASS[tone],
        pulse && "animate-pulse",
        className,
      )}
    >
      {label(raw)}
    </Badge>
  );
}
