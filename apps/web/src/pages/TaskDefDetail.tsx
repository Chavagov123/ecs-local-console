import { ArrowLeft, Copy, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import type { ApiError } from "@/api/client";
import { useDeregisterTaskDef, useRegisterTaskDef, useTaskDef } from "@/api/task-definitions";
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

export function TaskDefDetail() {
  const { family = "", revision = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useTaskDef(family, revision);
  const register = useRegisterTaskDef();
  const deregister = useDeregisterTaskDef();
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function registerCopy() {
    if (!data) return;
    try {
      const next = await register.mutateAsync(
        stripReadOnlyTaskDefFields(data.json) as Record<string, unknown>,
      );
      toast.success(`Registered ${next.family}:${next.revision}`);
      navigate(`/task-definitions/${next.family}/${next.revision}`);
    } catch (err) {
      const e = err as ApiError;
      toast.error(e.message, { description: e.hint });
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
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={registerCopy} disabled={register.isPending}>
              <Copy className="size-4" />
              Register as new revision
            </Button>
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
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
                    onClick={async () => {
                      try {
                        await deregister.mutateAsync({ family, revision: Number(revision) });
                        toast.success("Deregistered");
                      } catch (err) {
                        const e = err as ApiError;
                        toast.error(e.message, { description: e.hint });
                      }
                    }}
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
    </div>
  );
}
