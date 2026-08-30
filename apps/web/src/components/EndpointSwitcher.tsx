import { Check, ChevronsUpDown, Plus, Server } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useRuntimeConfig, useUpdateRuntimeConfig } from "@/api/config";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const KEY = "elc.endpoints";
const DEFAULTS = ["http://localhost:4566", "http://localhost:5001"];

function load(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
    return [...new Set([...DEFAULTS, ...saved])];
  } catch {
    return DEFAULTS;
  }
}

function save(list: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.filter((e) => !DEFAULTS.includes(e))));
  } catch {
    /* private mode — non-fatal */
  }
}

export function EndpointSwitcher() {
  const { data: config } = useRuntimeConfig();
  const update = useUpdateRuntimeConfig();
  const [endpoints, setEndpoints] = useState<string[]>(load);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const current = config?.endpoint;

  const switchTo = (endpoint: string) => {
    if (endpoint === current) return;
    update.mutate(
      { endpoint },
      {
        onSuccess: () => toast.success(`Now pointing at ${endpoint}`),
        onError: (e) => toast.error((e as Error).message),
      },
    );
  };

  const add = () => {
    const url = draft.trim();
    if (!url) return;
    const next = [...new Set([...endpoints, url])];
    setEndpoints(next);
    save(next);
    setDraft("");
    setAdding(false);
    switchTo(url);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="hidden gap-1.5 sm:flex">
            <Server className="size-3.5" />
            <span className="max-w-[12rem] truncate text-xs">{current ?? "endpoint"}</span>
            <ChevronsUpDown className="size-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>AWS endpoint</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {endpoints.map((e) => (
            <DropdownMenuItem key={e} onClick={() => switchTo(e)} className="font-mono text-xs">
              {e === current ? (
                <Check className="mr-2 size-3.5" />
              ) : (
                <span className="mr-2 inline-block size-3.5" />
              )}
              <span className="truncate">{e}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setAdding(true)}>
            <Plus className="mr-2 size-3.5" /> Add endpoint…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add an AWS endpoint</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="endpoint-url">Endpoint URL</Label>
            <Input
              id="endpoint-url"
              placeholder="http://localhost:4566"
              value={draft}
              onChange={(ev) => setDraft(ev.target.value)}
              onKeyDown={(ev) => ev.key === "Enter" && add()}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button onClick={add} disabled={!draft.trim()}>
              Add & switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
