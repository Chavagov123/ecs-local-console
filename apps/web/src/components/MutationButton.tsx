import { Loader2 } from "lucide-react";
import { forwardRef } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

interface MutationButtonProps extends ButtonProps {
  pending?: boolean;
  /** Optional label to show while pending; falls back to the children. */
  pendingLabel?: string;
}

/** A `Button` that shows a spinner and disables itself while a mutation is in flight. */
export const MutationButton = forwardRef<HTMLButtonElement, MutationButtonProps>(
  ({ pending, pendingLabel, disabled, children, ...props }, ref) => (
    <Button ref={ref} disabled={disabled || pending} {...props}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  ),
);
MutationButton.displayName = "MutationButton";
