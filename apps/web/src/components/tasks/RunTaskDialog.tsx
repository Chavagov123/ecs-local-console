import type { EcsFailure, LaunchType, RunTaskRequest } from "@ecs-local-console/shared";
import { Play } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useRunTask } from "@/api/tasks";
import { useTaskDefFamilies, useTaskDefRevisions } from "@/api/task-definitions";
import { MutationButton } from "@/components/MutationButton";
import { SecurityGroupPicker, SubnetPicker } from "@/components/pickers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { mutationErrorToast } from "@/lib/mutation-toast";

interface Props {
  cluster: string;
  /** Prefill the task definition (e.g. from a task-def detail page). */
  taskDefinition?: string;
  trigger?: React.ReactNode;
}

export function RunTaskDialog({ cluster, taskDefinition: prefill, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const run = useRunTask(cluster);
  const [failures, setFailures] = useState<EcsFailure[]>([]);

  const families = useTaskDefFamilies();
  const [family, setFamily] = useState(prefill?.split(":")[0] ?? "");
  const revisions = useTaskDefRevisions(family);
  const [revision, setRevision] = useState(prefill?.split(":")[1] ?? "");
  const [count, setCount] = useState(1);
  const [launchType, setLaunchType] = useState<LaunchType>("FARGATE");
  const [awsvpc, setAwsvpc] = useState(true);
  const [subnets, setSubnets] = useState<string[]>([]);
  const [securityGroups, setSecurityGroups] = useState<string[]>([]);

  const taskDefinition = family && revision ? `${family}:${revision}` : (prefill ?? "");
  const canSubmit = taskDefinition && (!awsvpc || subnets.length > 0);

  async function submit() {
    setFailures([]);
    const body: RunTaskRequest = {
      taskDefinition,
      count,
      launchType,
      ...(awsvpc
        ? {
            networkConfiguration: {
              awsvpcConfiguration: {
                subnets,
                securityGroups: securityGroups.length ? securityGroups : undefined,
              },
            },
          }
        : {}),
    };
    try {
      const result = await run.mutateAsync(body);
      if (result.failures.length) {
        setFailures(result.failures);
        toast.warning(
          `${result.tasks.length} of ${result.tasks.length + result.failures.length} tasks started`,
        );
        return; // keep the dialog open to show the failures
      }
      toast.success(count === 1 ? "Task started" : `${count} tasks started`);
      setOpen(false);
      const first = result.tasks[0];
      if (first) navigate(`/clusters/${cluster}/tasks/${first.taskId}`);
    } catch (e) {
      mutationErrorToast(e);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setFailures([]);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Play className="size-4" />
            Run task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Run task in {cluster}</DialogTitle>
          <DialogDescription>Start one or more standalone tasks (not managed by a service).</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rt-family">Task definition</Label>
              <Select value={family} onValueChange={(v) => { setFamily(v); setRevision(""); }}>
                <SelectTrigger id="rt-family">
                  <SelectValue placeholder="family" />
                </SelectTrigger>
                <SelectContent>
                  {(families.data ?? []).map((f) => (
                    <SelectItem key={f.family} value={f.family}>
                      {f.family}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rt-rev">Revision</Label>
              <Select value={revision} onValueChange={setRevision} disabled={!family}>
                <SelectTrigger id="rt-rev">
                  <SelectValue placeholder="rev" />
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rt-count">Count</Label>
              <Input
                id="rt-count"
                type="number"
                min={1}
                max={10}
                value={count}
                onChange={(e) => setCount(Math.min(10, Math.max(1, Number(e.target.value))))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rt-launch">Launch type</Label>
              <Select value={launchType} onValueChange={(v) => setLaunchType(v as LaunchType)}>
                <SelectTrigger id="rt-launch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FARGATE">FARGATE</SelectItem>
                  <SelectItem value="EC2">EC2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="rt-awsvpc">awsvpc networking</Label>
            <Switch id="rt-awsvpc" checked={awsvpc} onCheckedChange={setAwsvpc} />
          </div>
          {awsvpc && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="space-y-1.5">
                <Label htmlFor="rt-subnets">Subnets</Label>
                <SubnetPicker id="rt-subnets" value={subnets} onChange={setSubnets} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rt-sg">Security groups</Label>
                <SecurityGroupPicker id="rt-sg" value={securityGroups} onChange={setSecurityGroups} />
              </div>
            </div>
          )}

          {failures.length > 0 && (
            <Alert variant="destructive">
              <AlertTitle>{failures.length} placement failure(s)</AlertTitle>
              <AlertDescription>
                <ul className="mt-1 space-y-1 text-xs">
                  {failures.map((f, i) => (
                    <li key={i} className="font-mono">
                      {f.reason}
                      {f.detail ? ` — ${f.detail}` : ""}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <MutationButton pending={run.isPending} disabled={!canSubmit} onClick={submit}>
            Run
          </MutationButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
