import type { CreateServiceRequest, LaunchType } from "@ecs-local-console/shared";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTaskDefFamilies, useTaskDefRevisions } from "@/api/task-definitions";
import { useCreateService } from "@/api/services";
import { MutationButton } from "@/components/MutationButton";
import { SecurityGroupPicker, SubnetPicker } from "@/components/pickers";
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
import { useMutationToast } from "@/lib/mutation-toast";

export function CreateServiceDialog({ cluster }: { cluster: string }) {
  const [open, setOpen] = useState(false);
  const create = useMutationToast(useCreateService(cluster), {
    success: (s) => `Service "${s.name}" created`,
  });

  const families = useTaskDefFamilies();
  const [family, setFamily] = useState("");
  const revisions = useTaskDefRevisions(family);

  const [name, setName] = useState("");
  const [revision, setRevision] = useState("");
  const [desiredCount, setDesiredCount] = useState(1);
  const [launchType, setLaunchType] = useState<LaunchType>("FARGATE");
  const [awsvpc, setAwsvpc] = useState(true);
  const [subnets, setSubnets] = useState<string[]>([]);
  const [securityGroups, setSecurityGroups] = useState<string[]>([]);
  const [publicIp, setPublicIp] = useState(false);

  const taskDefinition = family && revision ? `${family}:${revision}` : "";
  const needsNetwork = awsvpc;
  const canSubmit = name.trim() && taskDefinition && (!needsNetwork || subnets.length > 0);

  async function submit() {
    const body: CreateServiceRequest = {
      serviceName: name.trim(),
      taskDefinition,
      desiredCount,
      launchType,
      ...(needsNetwork
        ? {
            networkConfiguration: {
              awsvpcConfiguration: {
                subnets,
                securityGroups: securityGroups.length ? securityGroups : undefined,
                assignPublicIp: publicIp ? "ENABLED" : "DISABLED",
              },
            },
          }
        : {}),
    };
    try {
      await create.run(body);
      setOpen(false);
      setName("");
      setSubnets([]);
      setSecurityGroups([]);
    } catch {
      /* toast shown; keep dialog open */
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Create service
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create service in {cluster}</DialogTitle>
          <DialogDescription>
            A service keeps a desired number of task copies running and replaces any that stop.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field label="Service name" htmlFor="svc-name">
            <Input id="svc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="web" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Task definition" htmlFor="svc-family">
              <Select value={family} onValueChange={(v) => { setFamily(v); setRevision(""); }}>
                <SelectTrigger id="svc-family">
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
            </Field>
            <Field label="Revision" htmlFor="svc-rev">
              <Select value={revision} onValueChange={setRevision} disabled={!family}>
                <SelectTrigger id="svc-rev">
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
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Desired count" htmlFor="svc-count">
              <Input
                id="svc-count"
                type="number"
                min={0}
                value={desiredCount}
                onChange={(e) => setDesiredCount(Math.max(0, Number(e.target.value)))}
              />
            </Field>
            <Field label="Launch type" htmlFor="svc-launch">
              <Select value={launchType} onValueChange={(v) => setLaunchType(v as LaunchType)}>
                <SelectTrigger id="svc-launch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FARGATE">FARGATE</SelectItem>
                  <SelectItem value="EC2">EC2</SelectItem>
                  <SelectItem value="EXTERNAL">EXTERNAL</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="svc-awsvpc">awsvpc networking</Label>
              <p className="text-xs text-muted-foreground">Required for Fargate.</p>
            </div>
            <Switch id="svc-awsvpc" checked={awsvpc} onCheckedChange={setAwsvpc} />
          </div>

          {awsvpc && (
            <div className="space-y-3 rounded-md border p-3">
              <Field label="Subnets" htmlFor="svc-subnets">
                <SubnetPicker id="svc-subnets" value={subnets} onChange={setSubnets} />
              </Field>
              <Field label="Security groups" htmlFor="svc-sg">
                <SecurityGroupPicker id="svc-sg" value={securityGroups} onChange={setSecurityGroups} />
              </Field>
              <div className="flex items-center justify-between">
                <Label htmlFor="svc-pubip">Assign public IP</Label>
                <Switch id="svc-pubip" checked={publicIp} onCheckedChange={setPublicIp} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <MutationButton pending={create.isPending} disabled={!canSubmit} onClick={submit}>
            Create
          </MutationButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
