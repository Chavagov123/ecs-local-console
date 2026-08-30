import {
  NETWORK_MODES,
  stripReadOnlyTaskDefFields,
  taskDefinitionSchema,
} from "@ecs-local-console/shared";
import { ArrowLeft, ClipboardPaste } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { FormProvider, useFieldArray, useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { zodToJsonSchema } from "zod-to-json-schema";
import { useRegisterTaskDef, useTaskDef } from "@/api/task-definitions";
import { MutationButton } from "@/components/MutationButton";
import { RolePicker } from "@/components/pickers";
import { ContainerSubForm } from "@/components/taskdef/ContainerSubForm";
import { ErrorState, LoadingRows } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TaskDefForm } from "@/components/taskdef/form-types";
import { useMutationToast } from "@/lib/mutation-toast";

const MonacoJsonEditor = lazy(() => import("@/components/MonacoJsonEditor"));

const EMPTY: TaskDefForm = {
  family: "",
  requiresCompatibilities: ["FARGATE"],
  networkMode: "awsvpc",
  cpu: "256",
  memory: "512",
  containerDefinitions: [{ name: "app", image: "", essential: true, memory: 256 }],
};

export function TaskDefEditor() {
  const { family, revision } = useParams();
  const seeding = !!family && !!revision;
  const seed = useTaskDef(family ?? "", revision ?? "");

  if (seeding && seed.isLoading) return <LoadingRows rows={4} />;
  if (seeding && seed.isError) return <ErrorState error={seed.error} />;

  const initial: TaskDefForm =
    seeding && seed.data
      ? (stripReadOnlyTaskDefFields(seed.data.json) as unknown as TaskDefForm)
      : EMPTY;

  return <Editor initial={initial} seededFrom={seeding ? `${family}:${revision}` : undefined} />;
}

function Editor({ initial, seededFrom }: { initial: TaskDefForm; seededFrom?: string }) {
  const navigate = useNavigate();
  const register = useMutationToast(useRegisterTaskDef(), {
    success: (d) => `Registered ${d.family}:${d.revision}`,
  });
  const [mode, setMode] = useState<"form" | "json">("form");
  const [json, setJson] = useState(() => JSON.stringify(initial, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);

  // No zodResolver: the shared schema is `.passthrough()`, which breaks RHF's
  // field-path types. Validation happens on submit + on the Form→JSON switch.
  const form = useForm<TaskDefForm>({ defaultValues: initial });
  const containers = useFieldArray({ control: form.control, name: "containerDefinitions" });

  const schema = useMemo(() => zodToJsonSchema(taskDefinitionSchema, "taskDef"), []);

  function switchTo(next: "form" | "json") {
    if (next === "json") {
      setJson(JSON.stringify(form.getValues(), null, 2));
      setJsonError(null);
    } else {
      const parsed = taskDefinitionSchema.safeParse(safeJsonParse(json));
      if (!parsed.success) {
        setJsonError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
        return;
      }
      form.reset(parsed.data as unknown as TaskDefForm);
    }
    setMode(next);
  }

  async function submit() {
    let source: unknown;
    if (mode === "json") {
      const parsed = taskDefinitionSchema.safeParse(safeJsonParse(json));
      if (!parsed.success) {
        setJsonError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
        return;
      }
      source = parsed.data;
    } else {
      const parsed = taskDefinitionSchema.safeParse(form.getValues());
      if (!parsed.success) {
        setJsonError(
          parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; "),
        );
        return;
      }
      source = parsed.data;
    }
    setJsonError(null);
    const body = stripReadOnlyTaskDefFields(source as Record<string, unknown>);
    try {
      const td = await register.run(body);
      navigate(`/task-definitions/${td.family}/${td.revision}`);
    } catch {
      /* toast shown */
    }
  }

  function applyPaste(text: string) {
    const obj = safeJsonParse(text);
    if (!obj) {
      setJsonError("Not valid JSON");
      return;
    }
    const cleaned = stripReadOnlyTaskDefFields(obj as Record<string, unknown>);
    const parsed = taskDefinitionSchema.safeParse(cleaned);
    if (parsed.success) {
      form.reset(parsed.data);
      setJson(JSON.stringify(parsed.data, null, 2));
      setMode("form");
    } else {
      setJson(JSON.stringify(cleaned, null, 2));
      setMode("json");
      setJsonError("Loaded, but has validation issues — fix them below.");
    }
    setPasteOpen(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
          <Link to="/task-definitions">
            <ArrowLeft className="size-4" />
            Task definitions
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {seededFrom ? `New revision of ${seededFrom.split(":")[0]}` : "Register task definition"}
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPasteOpen(true)}>
              <ClipboardPaste className="size-4" />
              Paste from CLI
            </Button>
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(v) => v && switchTo(v as "form" | "json")}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="form">Form</ToggleGroupItem>
              <ToggleGroupItem value="json">JSON</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </div>

      {jsonError && <ErrorState error={{ message: jsonError }} title="Validation" />}

      {mode === "form" ? (
        <FormProvider {...form}>
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <Card>
              <CardContent className="grid grid-cols-2 gap-3 p-4">
                <div className="col-span-2 space-y-1">
                  <Label htmlFor="td-family">Family</Label>
                  <Input id="td-family" {...form.register("family")} placeholder="web" />
                  {form.formState.errors.family && (
                    <p className="text-xs text-destructive">{form.formState.errors.family.message}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="td-netmode">Network mode</Label>
                  <Select
                    value={form.watch("networkMode") ?? "awsvpc"}
                    onValueChange={(v) => form.setValue("networkMode", v as TaskDefForm["networkMode"])}
                  >
                    <SelectTrigger id="td-netmode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NETWORK_MODES.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Compatibility</Label>
                  <Select
                    value={form.watch("requiresCompatibilities")?.[0] ?? "FARGATE"}
                    onValueChange={(v) =>
                      form.setValue("requiresCompatibilities", [v as "EC2" | "FARGATE"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FARGATE">FARGATE</SelectItem>
                      <SelectItem value="EC2">EC2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="td-cpu">Task CPU</Label>
                  <Input id="td-cpu" {...form.register("cpu")} placeholder="256" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="td-mem">Task memory</Label>
                  <Input id="td-mem" {...form.register("memory")} placeholder="512" />
                </div>
                <div className="space-y-1">
                  <Label>Task role</Label>
                  <RolePicker
                    kind="task"
                    value={form.watch("taskRoleArn")}
                    onChange={(v) => form.setValue("taskRoleArn", v)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Execution role</Label>
                  <RolePicker
                    kind="execution"
                    value={form.watch("executionRoleArn")}
                    onChange={(v) => form.setValue("executionRoleArn", v)}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {containers.fields.map((f, i) => (
                <ContainerSubForm
                  key={f.id}
                  index={i}
                  removable={containers.fields.length > 1}
                  onRemove={() => containers.remove(i)}
                />
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  containers.append({ name: `c${containers.fields.length + 1}`, image: "", essential: false })
                }
              >
                + Add container
              </Button>
            </div>

            {form.formState.errors.containerDefinitions && (
              <p className="text-xs text-destructive">
                {form.formState.errors.containerDefinitions.message ??
                  "Fix the container errors above."}
              </p>
            )}
          </form>
        </FormProvider>
      ) : (
        <Suspense fallback={<LoadingRows rows={8} />}>
          <MonacoJsonEditor value={json} onChange={setJson} schema={schema} />
        </Suspense>
      )}

      <div className="flex justify-end">
        <MutationButton pending={register.isPending} onClick={submit}>
          Register
        </MutationButton>
      </div>

      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Paste task-definition JSON</DialogTitle>
          </DialogHeader>
          <PasteBody onApply={applyPaste} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PasteBody({ onApply }: { onApply: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        className="font-mono text-xs"
        placeholder='Paste the output of `aws ecs register-task-definition --generate-cli-skeleton` or a describe-task-definition blob'
      />
      <DialogFooter>
        <Button disabled={!text.trim()} onClick={() => onApply(text)}>
          Load
        </Button>
      </DialogFooter>
    </>
  );
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
