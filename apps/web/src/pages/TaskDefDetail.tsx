import { ArrowLeft, Copy, Pencil, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useDeregisterTaskDef, useRegisterTaskDef, useTaskDef } from "@/api/task-definitions";
import { CopyAsCli } from "@/components/CopyAsCli";
import { MutationButton } from "@/components/MutationButton";
import { TagsEditor } from "@/components/TagsEditor";
import { StatusBadge } from "@/components/StatusBadge";
import { ErrorState, LoadingRows } from "@/components/States";
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
import { Card, CardContent } from "@/components/ui/card";
import { stripReadOnlyTaskDefFields } from "@ecs-local-console/shared";
import { useMutationToast } from "@/lib/mutation-toast";

export function TaskDefDetail() {
  const { family = "", revision = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useTaskDef(family, revision);
  const register = useMutationToast(useRegisterTaskDef(), {
    success: (d) => `Registered ${d.family}:${d.revision}`,
  });
  const deregister = useMutationToast(useDeregisterTaskDef(), { success: "Deregistered" });

  async function registerCopy() {
    if (!data) return;
    try {
      const next = await register.run(
        stripReadOnlyTaskDefFields(data.json) as Record<string, unknown>,
      );
      navigate(`/task-definitions/${next.family}/${next.revision}`);
    } catch {
      /* toast shown */
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
          <Link to={`/task-definitions/${family}`}>
            <ArrowLeft className="size-4" />
            {family}
          </Link>
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {family}:{revision}
            </h1>
            {data && <StatusBadge status={data.status} kind="service" />}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={`/task-definitions/${family}/compare`}>Compare revisions</Link>
            </Button>
            {data && <CopyAsCli resource={{ kind: "taskDef", taskDef: data }} />}
            <Button asChild variant="outline" size="sm">
              <Link to={`/task-definitions/${family}/${revision}/edit`}>
                <Pencil className="size-4" />
                Edit as new revision
              </Link>
            </Button>
            <MutationButton
              variant="outline"
              size="sm"
              pending={register.isPending}
              onClick={registerCopy}
            >
              <Copy className="size-4" />
              Clone as-is
            </MutationButton>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={data?.status === "INACTIVE"}>
                  <Trash2 className="size-4" />
                  Deregister
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Deregister {family}:{revision}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    The revision becomes INACTIVE. Running tasks keep working; you just can't
                    start new ones from it.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      deregister.run({ family, revision: Number(revision) }).catch(() => {})
                    }
                  >
                    Deregister
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {isError && <ErrorState error={error} />}
      {isLoading && <LoadingRows rows={3} />}

      {data && (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-muted-foreground">
              <span>RegisterTaskDefinition JSON</span>
              <button
                type="button"
                className="flex items-center gap-1 hover:text-foreground"
                onClick={() => {
                  void navigator.clipboard.writeText(JSON.stringify(data.json, null, 2));
                  toast.success("Copied");
                }}
              >
                <Copy className="size-3" />
                Copy
              </button>
            </div>
            <pre className="max-h-[36rem] overflow-auto p-4 text-xs">
              {JSON.stringify(data.json, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {data && <TagsEditor resourceArn={data.arn} tags={data.tags} />}
    </div>
  );
}
