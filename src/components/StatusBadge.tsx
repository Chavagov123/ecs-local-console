import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "running" | "stopped" | "pending" | "error";
  className?: string;
}

export const StatusBadge = ({ status, className }: StatusBadgeProps) => {
  const statusConfig = {
    running: {
      label: "Running",
      className: "bg-success/20 text-success border-success/30",
    },
    stopped: {
      label: "Stopped",
      className: "bg-muted text-muted-foreground border-border",
    },
    pending: {
      label: "Pending",
      className: "bg-warning/20 text-warning border-warning/30",
    },
    error: {
      label: "Error",
      className: "bg-destructive/20 text-destructive border-destructive/30",
    },
  };

  const config = statusConfig[status];

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
};
