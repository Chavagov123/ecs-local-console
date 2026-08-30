import { ArrowLeft } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useTaskDef, useTaskDefRevisions } from "@/api/task-definitions";
import { LoadingRows } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { stripReadOnlyTaskDefFields } from "@ecs-local-console/shared";

const MonacoDiff = lazy(() => import("@/components/MonacoDiff"));

function normalize(json: Record<string, unknown> | undefined): string {
  if (!json) return "";
  return JSON.stringify(stripReadOnlyTaskDefFields(json), null, 2);
}

export function RevisionDiff() {
  const { family = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const { data: revisions } = useTaskDefRevisions(family);

  const sorted = useMemo(
    () => [...(revisions ?? [])].sort((a, b) => b.revision - a.revision),
    [revisions],
  );

  const [left, setLeft] = useState(params.get("a") ?? "");
  const [right, setRight] = useState(params.get("b") ?? "");

  useEffect(() => {
    if (sorted.length < 2) return;
    if (!left) setLeft(String(sorted[1].revision));
    if (!right) setRight(String(sorted[0].revision));
  }, [sorted, left, right]);

  useEffect(() => {
    if (left && right) setParams({ a: left, b: right }, { replace: true });
  }, [left, right, setParams]);

  const leftTd = useTaskDef(family, left);
  const rightTd = useTaskDef(family, right);

  return (
    <div className="space-y-4">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 text-muted-foreground">
          <Link to={`/task-definitions/${family}`}>
            <ArrowLeft className="size-4" />
            {family}
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Compare revisions</h1>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <RevisionSelect label="Base" value={left} onChange={setLeft} options={sorted} />
        <span className="text-muted-foreground">→</span>
        <RevisionSelect label="Compare" value={right} onChange={setRight} options={sorted} />
      </div>

      <Card>
        <CardContent className="p-3">
          {leftTd.isLoading || rightTd.isLoading ? (
            <LoadingRows rows={6} />
          ) : (
            <Suspense fallback={<LoadingRows rows={6} />}>
              <MonacoDiff
                original={normalize(leftTd.data?.json)}
                modified={normalize(rightTd.data?.json)}
              />
            </Suspense>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RevisionSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { revision: number }[];
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-24">
          <SelectValue placeholder="rev" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.revision} value={String(o.revision)}>
              :{o.revision}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}
