import { Construction } from "lucide-react";

export function Placeholder({ title, milestone }: { title: string; milestone: string }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <Construction className="mx-auto mb-4 size-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This screen lands in milestone {milestone}. The clusters list and settings are live now.
      </p>
    </div>
  );
}
