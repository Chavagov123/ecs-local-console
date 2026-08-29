import { type AnnotationKey, annotation } from "@ecs-local-console/shared";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface InfoHintProps {
  /** A known annotation key, or pass `text` for a one-off. */
  hint?: AnnotationKey;
  text?: string;
  className?: string;
}

/**
 * A small info icon with a one-sentence tooltip. Used sparingly next to badges,
 * column headers, and timeline entries — never as a modal or coach-mark.
 */
export function InfoHint({ hint, text, className }: InfoHintProps) {
  const content = text ?? (hint ? annotation(hint) : "");
  if (!content) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex align-middle text-muted-foreground/70 hover:text-muted-foreground",
            className,
          )}
          aria-label="More information"
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed">{content}</TooltipContent>
    </Tooltip>
  );
}
