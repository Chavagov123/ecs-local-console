import type { ServiceDetail } from "@ecs-local-console/shared";
import { Minus, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDeleteService, useUpdateService } from "@/api/services";
import { useTaskDefRevisions } from "@/api/task-definitions";
import { MutationButton } from "@/components/MutationButton";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutationToast } from "@/lib/mutation-toast";

export function ServiceActions({ svc }: { svc: ServiceDetail }) {
  const cluster = clusterName(svc.clusterArn);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DesiredCountStepper cluster={cluster} service={svc.name} value={svc.desiredCount} />
      <UpdateServiceDialog svc={svc} cluster={cluster} />
      <ForceDeployButton cluster={cluster} service={svc.name} />
      <DeleteServiceButton cluster={cluster} service={svc.name} />
    </div>
  );
}

function clusterName(arn: string): string {
  return arn.includes("/") ? arn.slice(arn.lastIndexOf("/") + 1) : arn;
}

/** Inline `- N +` with a 400ms debounce so a run of clicks becomes one PATCH. */
function DesiredCountStepper({
  cluster,
  service,
  value,
}: {
  cluster: string;
  service: string;
  value: number;
}) {
  const update = useUpdateService(cluster);
  const [local, setLocal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!update.isPending) setLocal(value);
  }, [value, update.isPending]);

  const nudge = (delta: number) => {
    const next = Math.max(0, local + delta);
    setLocal(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (next !== value) update.mutate({ service, desiredCount: next });
    }, 400);
  };

  return (
    <div className="flex items-center rounded-md border">
      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-r-none"
        onClick={() => nudge(-1)}
        disabled={local === 0}
        aria-label="decrease desired count"
      >
        <Minus className="size-4" />
      </Button>
      <span className="w-10 text-center text-sm tabular-nums" aria-live="polite">
        {local}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 rounded-l-none"
        onClick={() => nudge(1)}
        aria-label="increase desired count"
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}

function ForceDeployButton({ cluster, service }: { cluster: string; service: string }) {
  const force = useMutationToast(useUpdateService(cluster), { success: "New deployment started" });
  return (
    <MutationButton
      variant="outline"
      size="sm"
      pending={force.isPending}
      onClick={() => force.run({ service, forceNewDeployment: true }).catch(() => {})}
    >
      <RefreshCw className="size-4" />
      Force new deployment
    </MutationButton>
  );
}

function UpdateServiceDialog({ svc, cluster }: { svc: ServiceDetail; cluster: string }) {
  const [open, setOpen] = useState(false);
  const family = svc.taskDefinition.split(":")[0] ?? svc.taskDefinition;
  const revisions = useTaskDefRevisions(family);
  const [revision, setRevision] = useState(svc.taskDefinition.split(":")[1] ?? "");
  const [forceNew, setForceNew] = useState(false);
  const update = useMutationToast(useUpdateService(cluster), { success: "Service updated" });

  async function submit() {
    try {
      await update.run({
        service: svc.name,
        taskDefinition: `${family}:${revision}`,
        forceNewDeployment: forceNew || undefined,
      });
      setOpen(false);
    } catch {
      /* keep open */
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Update…
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update {svc.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="upd-rev">Task-definition revision ({family})</Label>
            <Select value={revision} onValueChange={setRevision}>
              <SelectTrigger id="upd-rev">
                <SelectValue placeholder="revision" />
              </SelectTrigger>
              <SelectContent>
                {(revisions.data ?? []).map((r) => (
                  <SelectItem key={r.revision} value={String(r.revision)}>
                    {family}:{r.revision}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={forceNew} onCheckedChange={(v) => setForceNew(!!v)} />
            Force a new deployment even if the revision is unchanged
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <MutationButton pending={update.isPending} disabled={!revision} onClick={submit}>
            Update
          </MutationButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteServiceButton({ cluster, service }: { cluster: string; service: string }) {
  const navigate = useNavigate();
  const [force, setForce] = useState(false);
  const del = useMutationToast(useDeleteService(cluster), { success: `Service "${service}" deleted` });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Trash2 className="size-4" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete service &ldquo;{service}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            ECS scales the service to 0 and removes it. Without force, it must already be at
            desiredCount 0.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={force} onCheckedChange={(v) => setForce(!!v)} />
          Force (delete even with running tasks)
        </label>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={async () => {
              try {
                await del.run({ service, force });
                navigate(`/clusters/${cluster}?tab=services`);
              } catch {
                /* toast shown */
              }
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
