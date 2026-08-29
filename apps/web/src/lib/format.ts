/** Relative time like "3m ago" / "just now"; absolute on hover elsewhere. */
export function relativeTime(iso: string | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const secs = Math.round((Date.now() - then) / 1000);
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export function absoluteTime(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

/** `arn:aws:ecs:us-east-1:0:task-definition/web:3` -> `web:3` */
export function taskDefLabel(v: string | undefined): string {
  if (!v) return "—";
  return v.includes("task-definition/") ? v.slice(v.indexOf("task-definition/") + 16) : v;
}
