/**
 * Tiny in-process TTL cache. Wraps read-heavy `List*` → `Describe*` fan-outs so
 * that many browser tabs polling the same resource collapse onto ~one upstream
 * call per TTL window.
 */
export class TtlCache {
  private store = new Map<string, { value: unknown; expiresAt: number }>();
  private inflight = new Map<string, { promise: Promise<unknown>; generation: number }>();
  /**
   * Bumped on every invalidate. A read that was already in flight when a write
   * landed carries the old generation, so its (pre-write) result is dropped
   * rather than cached — otherwise a mutation could be masked for a full TTL.
   */
  private generation = 0;

  constructor(private readonly ttlMs = 1500) {}

  async wrap<T>(key: string, produce: () => Promise<T>): Promise<T> {
    const hit = this.store.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value as T;

    const pending = this.inflight.get(key);
    if (pending) return pending.promise as Promise<T>;

    const generation = this.generation;
    const promise = (async () => {
      try {
        const value = await produce();
        if (this.generation === generation) {
          this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
        }
        return value;
      } finally {
        const current = this.inflight.get(key);
        if (current?.generation === generation) this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, { promise, generation });
    return promise as Promise<T>;
  }

  /** Drop cached values (and disarm in-flight reads) matching `prefix`, or all. */
  invalidate(prefix?: string): void {
    this.generation += 1;
    if (!prefix) {
      this.store.clear();
      this.inflight.clear();
      return;
    }
    for (const k of this.store.keys()) if (k.startsWith(prefix)) this.store.delete(k);
    for (const k of this.inflight.keys()) if (k.startsWith(prefix)) this.inflight.delete(k);
  }
}
