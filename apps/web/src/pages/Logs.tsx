import { ScrollText } from "lucide-react";

export function Logs() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <ScrollText className="mx-auto mb-4 size-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold">Log viewer</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        CloudWatch Logs streaming (follow, filter, per-container task logs) lands in v0.3.0.
      </p>
    </div>
  );
}
