import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";
import type { ApiError } from "@/api/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function ErrorState({ error, title = "Something went wrong" }: { error: unknown; title?: string }) {
  const e = error as ApiError;
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {e?.message ?? String(error)}
        {e?.hint && <span className="mt-1 block text-xs opacity-80">{e.hint}</span>}
      </AlertDescription>
    </Alert>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="p-10 text-center text-sm text-muted-foreground">{children}</div>;
}
