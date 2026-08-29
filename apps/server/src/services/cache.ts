/**
 * Tiny in-process TTL cache. Wraps read-heavy `List*` → `Describe*` fan-outs so
 * that many browser tabs polling the same resource collapse onto ~one upstream
 * call per TTL window.
 */
export class TtlCache {
  private store = new Map<string, { value: unknown; expiresAt: number }>();
  private inflight = new Map<string, Promise<unknown>>();

  constructor(private readonly ttlMs = 1500) {}

  async wrap<T>(key: string, produce: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = this.store.get(key);
    if (hit && hit.expiresAt > now) return hit.value as T;

    const pending = this.inflight.get(key);
    if (pending) return pending as Promise<T>;

    const p = (async () => {
      try {
        const value = await produce();
        this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, p);
    return p as Promise<T>;
  }

  invalidate(prefix?: string): void {
    if (!prefix) {
      this.store.clear();
      return;
    }
    for (const k of this.store.keys()) if (k.startsWith(prefix)) this.store.delete(k);
  }
}
