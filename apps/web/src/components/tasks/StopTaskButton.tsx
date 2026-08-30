import { Square } from "lucide-react";
import { useState } from "react";
import { useStopTask } from "@/api/tasks";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutationToast } from "@/lib/mutation-toast";

interface Props {
  cluster: string;
  taskId: string;
  variant?: "button" | "menuitem";
}

export function StopTaskButton({ cluster, taskId, variant = "button" }: Props) {
  const [reason, setReason] = useState("");
  const stop = useMutationToast(useStopTask(cluster), { success: "Task stopped" });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {variant === "button" ? (
          <Button variant="outline" size="sm">
            <Square className="size-4" />
            Stop
          </Button>
        ) : (
          <button
            type="button"
            className="flex w-full items-center gap-2 px-2 py-1.5 text-sm text-destructive hover:bg-accent"
          >
            <Square className="size-3.5" />
            Stop task
          </button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Stop task {taskId.slice(0, 12)}?</AlertDialogTitle>
          <AlertDialogDescription>
            A service-managed task will be replaced by the scheduler. A standalone task just stops.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="stop-reason">Reason (optional)</Label>
          <Input
            id="stop-reason"
            value={reason}
            maxLength={255}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Stopped from ECS Local Console"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => stop.run({ taskId, reason: reason.trim() || undefined }).catch(() => {})}
          >
            Stop task
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
