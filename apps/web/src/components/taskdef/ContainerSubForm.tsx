import { Trash2 } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import type { TaskDefForm } from "./form-types";

type ContainerPath = `containerDefinitions.${number}`;

/** Empty number inputs must become `undefined`, not `NaN` (which fails zod). */
const asOptionalNumber = {
  setValueAs: (v: unknown) =>
    v === "" || v === null || v === undefined ? undefined : Number(v),
} as const;

export function ContainerSubForm({
  index,
  onRemove,
  removable,
}: {
  index: number;
  onRemove: () => void;
  removable: boolean;
}) {
  const { register, watch, setValue } = useFormContext<TaskDefForm>();
  const base = `containerDefinitions.${index}` as const;

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Container {index + 1}</span>
          {removable && (
            <Button type="button" variant="ghost" size="icon" className="size-7" onClick={onRemove}>
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Row label="Name">
            <Input {...register(`${base}.name`)} placeholder="app" />
          </Row>
          <Row label="Image">
            <Input {...register(`${base}.image`)} placeholder="nginx:latest" />
          </Row>
          <Row label="Memory (MiB)">
            <Input type="number" {...register(`${base}.memory`, asOptionalNumber)} />
          </Row>
          <Row label="CPU units">
            <Input type="number" {...register(`${base}.cpu`, asOptionalNumber)} />
          </Row>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={watch(`${base}.essential`) ?? true}
            onCheckedChange={(v) => setValue(`${base}.essential`, v)}
          />
          Essential (task stops if this container exits)
        </label>

        <PortMappings base={base} />
        <EnvVars base={base} />
        <LogConfig base={base} />
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function PortMappings({ base }: { base: ContainerPath }) {
  const { register, control } = useFormContext<TaskDefForm>();
  const { fields, append, remove } = useFieldArray({ control, name: `${base}.portMappings` });
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Port mappings</Label>
        <Button type="button" variant="ghost" size="sm" onClick={() => append({ containerPort: 80 })}>
          + port
        </Button>
      </div>
      {fields.map((f, i) => (
        <div key={f.id} className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="container"
            className="h-8"
            {...register(`${base}.portMappings.${i}.containerPort`, asOptionalNumber)}
          />
          <Input
            type="number"
            placeholder="host (0 = dynamic)"
            className="h-8"
            {...register(`${base}.portMappings.${i}.hostPort`, asOptionalNumber)}
          />
          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => remove(i)}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function EnvVars({ base }: { base: ContainerPath }) {
  const { register, control } = useFormContext<TaskDefForm>();
  const { fields, append, remove } = useFieldArray({ control, name: `${base}.environment` });
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Environment</Label>
        <Button type="button" variant="ghost" size="sm" onClick={() => append({ name: "", value: "" })}>
          + var
        </Button>
      </div>
      {fields.map((f, i) => (
        <div key={f.id} className="flex items-center gap-2">
          <Input placeholder="KEY" className="h-8" {...register(`${base}.environment.${i}.name`)} />
          <Input placeholder="value" className="h-8" {...register(`${base}.environment.${i}.value`)} />
          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => remove(i)}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function LogConfig({ base }: { base: ContainerPath }) {
  const { register, watch, setValue } = useFormContext<TaskDefForm>();
  const driver = watch(`${base}.logConfiguration.logDriver`);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Log driver</Label>
      <Select
        value={driver ?? "none"}
        onValueChange={(v) => {
          if (v === "none") setValue(`${base}.logConfiguration`, undefined);
          else if (v === "awslogs")
            setValue(`${base}.logConfiguration`, {
              logDriver: "awslogs",
              options: {
                "awslogs-group": `/ecs/${watch("family") || "task"}`,
                "awslogs-region": "us-east-1",
                "awslogs-stream-prefix": "ecs",
                "awslogs-create-group": "true",
              },
            });
          else setValue(`${base}.logConfiguration`, { logDriver: v });
        }}
      >
        <SelectTrigger className="h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">none</SelectItem>
          <SelectItem value="awslogs">awslogs (CloudWatch)</SelectItem>
          <SelectItem value="json-file">json-file</SelectItem>
        </SelectContent>
      </Select>
      {driver === "awslogs" && (
        <div className="grid grid-cols-2 gap-2">
          <Input
            className="h-8"
            placeholder="awslogs-group"
            {...register(`${base}.logConfiguration.options.awslogs-group` as const)}
          />
          <Input
            className="h-8"
            placeholder="stream-prefix"
            {...register(`${base}.logConfiguration.options.awslogs-stream-prefix` as const)}
          />
        </div>
      )}
    </div>
  );
}
