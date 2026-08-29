import type { TaskSummary } from "@ecs-local-console/shared";
import { Link } from "react-router-dom";
import { InfoHint } from "@/components/InfoHint";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { relativeTime, taskDefLabel } from "@/lib/format";

function clusterName(arn: string): string {
  return arn.includes("/") ? arn.slice(arn.lastIndexOf("/") + 1) : arn;
}

export function TaskTable({
  tasks,
  cluster,
  showCluster = false,
}: {
  tasks: TaskSummary[];
  /** Fixed cluster for links; omit when rows span clusters (use showCluster). */
  cluster?: string;
  showCluster?: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Task</TableHead>
          {showCluster && <TableHead>Cluster</TableHead>}
          <TableHead>Last status</TableHead>
          <TableHead>Task definition</TableHead>
          <TableHead>Started</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((t) => {
          const c = cluster ?? clusterName(t.clusterArn);
          return (
            <TableRow key={t.arn || t.taskId}>
              <TableCell className="font-mono text-xs">
                <Link className="hover:underline" to={`/clusters/${c}/tasks/${t.taskId}`}>
                  {t.taskId.slice(0, 12)}
                </Link>
              </TableCell>
              {showCluster && <TableCell className="text-sm">{c}</TableCell>}
              <TableCell>
                <span className="flex items-center gap-1.5">
                  <StatusBadge status={t.lastStatus} kind="task" pulse={t.transitioning} />
                  {t.transitioning && (
                    <span className="text-xs text-muted-foreground">→ {t.desiredStatus}</span>
                  )}
                  {t.stoppedReason && <InfoHint text={t.stoppedReason} />}
                </span>
              </TableCell>
              <TableCell className="font-mono text-xs">{taskDefLabel(t.taskDefinition)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {relativeTime(t.startedAt ?? t.createdAt)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
