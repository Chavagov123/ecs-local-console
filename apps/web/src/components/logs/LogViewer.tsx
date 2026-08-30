import type { LogEvent } from "@ecs-local-console/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLogEvents } from "@/api/logs";
import { ErrorState, LoadingRows } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const RANGES: Record<string, number | undefined> = {
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "24h": 24 * 60 * 60_000,
  all: undefined,
};

function ts(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour12: false }) + "." +
    String(ms % 1000).padStart(3, "0");
}

export function LogViewer({
  logGroup,
  logStream,
}: {
  logGroup: string;
  logStream?: string;
}) {
  const [rangeKey, setRangeKey] = useState<keyof typeof RANGES>("1h");
  const [filterInput, setFilterInput] = useState("");
  const [filterPattern, setFilterPattern] = useState("");
  const [follow, setFollow] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setFilterPattern(filterInput.trim()), 400);
    return () => clearTimeout(t);
  }, [filterInput]);

  const start = useMemo(() => {
    const span = RANGES[rangeKey];
    return span ? Date.now() - span : undefined;
  }, [rangeKey]);

  const query = useLogEvents({
    logGroup,
    logStream,
    filterPattern: filterPattern || undefined,
    start,
    follow,
  });

  const events: LogEvent[] = useMemo(() => {
    const all = (query.data?.pages ?? []).flatMap((p) => p.events);
    // GetLogEvents returns ascending; FilterLogEvents too — keep chronological.
    return all.sort((a, b) => a.timestamp - b.timestamp);
  }, [query.data]);

  const multiStream = !logStream;

  useEffect(() => {
    if (follow && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, follow]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={rangeKey} onValueChange={(v) => setRangeKey(v as keyof typeof RANGES)}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="15m">Last 15m</SelectItem>
            <SelectItem value="1h">Last 1h</SelectItem>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
        <Input
          className="max-w-xs"
          placeholder="Filter pattern (e.g. ERROR)"
          value={filterInput}
          onChange={(e) => setFilterInput(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={follow} onCheckedChange={setFollow} />
          Follow
        </label>
        <Button
          variant="outline"
          size="sm"
          disabled={!query.hasNextPage || query.isFetchingNextPage}
          onClick={() => query.fetchNextPage()}
        >
          {query.isFetchingNextPage ? "Loading…" : "Load older"}
        </Button>
      </div>

      {query.isError && <ErrorState error={query.error} title="Couldn't load logs" />}
      {query.isLoading && <LoadingRows rows={6} />}

      {!query.isLoading && !query.isError && (
        <div
          ref={scrollRef}
          className="h-[26rem] overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed"
        >
          {events.length === 0 ? (
            <p className="text-muted-foreground">No log events in this range.</p>
          ) : (
            events.map((e) => (
              <div key={e.eventId} className="flex gap-3 whitespace-pre-wrap break-all">
                <span className="shrink-0 text-muted-foreground">{ts(e.timestamp)}</span>
                {multiStream && e.logStreamName && (
                  <span className="shrink-0 text-accent-foreground/80">
                    {e.logStreamName.slice(-24)}
                  </span>
                )}
                <span>{e.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
