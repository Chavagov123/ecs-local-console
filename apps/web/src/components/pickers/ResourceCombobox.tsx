import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ComboOption {
  value: string;
  label: string;
  hint?: string;
}

interface Props {
  options: ComboOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  multiple?: boolean;
  placeholder?: string;
  /** Shown when the backing query errored / the emulator can't list this resource. */
  unavailable?: boolean;
  loading?: boolean;
  id?: string;
}

/**
 * A `Popover` + `cmdk` combobox for picking one or many AWS resource ids
 * (subnets / security groups / roles). Falls back to a free-text input when the
 * emulator doesn't implement the listing endpoint.
 */
export function ResourceCombobox({
  options,
  selected,
  onChange,
  multiple = false,
  placeholder = "Select…",
  unavailable,
  loading,
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState("");

  if (unavailable) {
    return (
      <div className="space-y-1">
        <Input
          id={id}
          placeholder="Type ids, comma-separated"
          value={selected.join(", ")}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
        />
        <p className="text-xs text-muted-foreground">
          This emulator doesn&apos;t expose this resource — enter ids manually.
        </p>
      </div>
    );
  }

  const toggle = (value: string) => {
    if (multiple) {
      onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
    } else {
      onChange([value]);
      setOpen(false);
    }
  };

  const labelFor = (v: string) => options.find((o) => o.value === v)?.label ?? v;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {selected.length === 0
              ? loading
                ? "Loading…"
                : placeholder
              : multiple
                ? `${selected.length} selected`
                : labelFor(selected[0]!)}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>
              <div className="space-y-2 p-2 text-sm">
                <p className="text-muted-foreground">No match.</p>
                <div className="flex gap-1">
                  <Input
                    value={manual}
                    placeholder="add id manually"
                    onChange={(e) => setManual(e.target.value)}
                    className="h-8"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!manual.trim()}
                    onClick={() => {
                      toggle(manual.trim());
                      setManual("");
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.value} value={`${o.label} ${o.value}`} onSelect={() => toggle(o.value)}>
                  <Check
                    className={cn(
                      "size-4",
                      selected.includes(o.value) ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
