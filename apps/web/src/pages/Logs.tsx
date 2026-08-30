import { ScrollText, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLogGroups } from "@/api/logs";
import { LogViewer } from "@/components/logs/LogViewer";
import { EmptyState, ErrorState, LoadingRows } from "@/components/States";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function Logs() {
  const [params, setParams] = useSearchParams();
  const selected = params.get("group") ?? "";
  const [filter, setFilter] = useState("");
  const { data, isLoading, isError, error } = useLogGroups();

  const groups = useMemo(() => {
    const all = data?.groups ?? [];
    const q = filter.trim().toLowerCase();
    return q ? all.filter((g) => g.name.toLowerCase().includes(q)) : all;
  }, [data, filter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ScrollText className="size-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">Logs</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <Card>
          <CardContent className="space-y-2 p-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                className="pl-7"
                placeholder="Filter log groups"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            {isLoading && <LoadingRows rows={5} />}
            {isError && <ErrorState error={error} title="Couldn't load log groups" />}
            {!isLoading && !isError && groups.length === 0 && (
              <EmptyState>No log groups. They appear once a task writes its first line.</EmptyState>
            )}
            <ul className="max-h-[28rem] space-y-0.5 overflow-auto">
              {groups.map((g) => (
                <li key={g.name}>
                  <button
                    type="button"
                    onClick={() => setParams({ group: g.name }, { replace: true })}
                    className={cn(
                      "w-full truncate rounded px-2 py-1.5 text-left font-mono text-xs hover:bg-muted",
                      g.name === selected && "bg-muted font-medium",
                    )}
                    title={g.name}
                  >
                    {g.name}
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            {selected ? (
              <LogViewer logGroup={selected} />
            ) : (
              <EmptyState>Pick a log group to stream its events.</EmptyState>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
