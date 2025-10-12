import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
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
    exited: {
      label: "Exited",
      className: "bg-muted text-muted-foreground border-border",
    },
    created: {
      label: "Created",
      className: "bg-warning/20 text-warning border-warning/30",
    },
    restarting: {
      label: "Restarting",
      className: "bg-warning/20 text-warning border-warning/30",
    },
    paused: {
      label: "Paused",
      className: "bg-muted text-muted-foreground border-border",
    },
  };

  // Normalize the status to lowercase for comparison
  const normalizedStatus = status?.toLowerCase() || 'unknown';
  
  // Get config for the status, fallback to a default if not found
  const config = statusConfig[normalizedStatus as keyof typeof statusConfig] || {
    label: status || 'Unknown',
    className: "bg-muted text-muted-foreground border-border",
  };

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
};
