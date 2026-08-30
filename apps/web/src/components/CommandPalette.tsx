import { Boxes, FileCode2, MoonStar, Plus, ScrollText, Server } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useClusters } from "@/api/clusters";
import { useTaskDefFamilies } from "@/api/task-definitions";
import { useEventStream } from "@/components/events/EventStreamProvider";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

/** Global ⌘K / Ctrl-K palette: jump to any resource + run core actions. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { setTheme, theme } = useTheme();
  const { data: clusters } = useClusters();
  const { data: families } = useTaskDefFamilies();
  const { events } = useEventStream();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  const recent = (clusters ?? []).flatMap((c) => events(c.name)).slice(0, 6);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to a cluster, service, task definition, or run an action…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/clusters")}>
            <Plus className="mr-2 size-4" /> Create cluster
          </CommandItem>
          <CommandItem onSelect={() => go("/task-definitions/new")}>
            <FileCode2 className="mr-2 size-4" /> Register task definition
          </CommandItem>
          <CommandItem onSelect={() => go("/logs")}>
            <ScrollText className="mr-2 size-4" /> Go to Logs
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setTheme(theme === "dark" ? "light" : "dark");
              setOpen(false);
            }}
          >
            <MoonStar className="mr-2 size-4" /> Toggle theme
          </CommandItem>
        </CommandGroup>

        {clusters && clusters.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Clusters">
              {clusters.map((c) => (
                <CommandItem
                  key={c.name}
                  value={`cluster ${c.name}`}
                  onSelect={() => go(`/clusters/${c.name}`)}
                >
                  <Boxes className="mr-2 size-4" />
                  {c.name}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {c.activeServicesCount} svc · {c.runningTasksCount} running
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {families && families.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Task definitions">
              {families.slice(0, 25).map((f) => (
                <CommandItem
                  key={f.family}
                  value={`taskdef ${f.family}`}
                  onSelect={() => go(`/task-definitions/${f.family}`)}
                >
                  <FileCode2 className="mr-2 size-4" />
                  {f.family}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {recent.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent changes">
              {recent.map((e) => (
                <CommandItem
                  key={e.id}
                  value={`event ${e.id} ${e.type} ${e.resource}`}
                  onSelect={() =>
                    go(
                      e.service
                        ? `/clusters/${e.cluster}/services/${e.service}?tab=reconciliation`
                        : `/clusters/${e.cluster}`,
                    )
                  }
                >
                  <Server className="mr-2 size-4" />
                  <span className="truncate">
                    {e.type} — {e.detail ?? e.resource}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
