import { Plus, Tag, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAddTags, useRemoveTags } from "@/api/tags";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/**
 * Key/value tag editor for a cluster / service / task / task-definition. Writes
 * go straight through `TagResource` / `UntagResource`; the parent re-fetches.
 */
export function TagsEditor({
  resourceArn,
  tags,
}: {
  resourceArn: string;
  tags: Record<string, string>;
}) {
  const add = useAddTags();
  const remove = useRemoveTags();
  const [k, setK] = useState("");
  const [v, setV] = useState("");

  const entries = Object.entries(tags);
  const busy = add.isPending || remove.isPending;

  const onAdd = () => {
    const key = k.trim();
    if (!key) return;
    add.mutate(
      { resourceArn, tags: { [key]: v.trim() } },
      {
        onSuccess: () => {
          setK("");
          setV("");
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  const onRemove = (key: string) => {
    remove.mutate(
      { resourceArn, tagKeys: [key] },
      { onError: (e) => toast.error((e as Error).message) },
    );
  };

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Tag className="size-3.5" /> Tags
        </p>

        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tags.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {entries.map(([key, value]) => (
              <li
                key={key}
                className="flex items-center gap-1.5 rounded border bg-muted/40 px-2 py-1 font-mono text-xs"
              >
                <span>
                  {key}
                  {value ? `=${value}` : ""}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onRemove(key)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remove tag ${key}`}
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="h-8 max-w-[10rem]"
            placeholder="key"
            value={k}
            onChange={(e) => setK(e.target.value)}
          />
          <Input
            className="h-8 max-w-[12rem]"
            placeholder="value"
            value={v}
            onChange={(e) => setV(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAdd()}
          />
          <Button size="sm" variant="outline" disabled={busy || !k.trim()} onClick={onAdd}>
            <Plus className="size-3.5" /> Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
