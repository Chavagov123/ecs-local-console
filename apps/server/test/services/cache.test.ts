import { describe, expect, it } from "vitest";
import { TtlCache } from "../../src/services/cache.js";

/** A promise you can resolve from the outside. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("TtlCache", () => {
  it("serves a cached value within the TTL", async () => {
    const cache = new TtlCache(1000);
    let calls = 0;
    const produce = async () => ++calls;
    expect(await cache.wrap("k", produce)).toBe(1);
    expect(await cache.wrap("k", produce)).toBe(1);
    expect(calls).toBe(1);
  });

  it("coalesces concurrent reads of the same key", async () => {
    const cache = new TtlCache(1000);
    let calls = 0;
    const d = deferred<number>();
    const produce = () => {
      calls++;
      return d.promise;
    };
    const a = cache.wrap("k", produce);
    const b = cache.wrap("k", produce);
    d.resolve(7);
    expect(await a).toBe(7);
    expect(await b).toBe(7);
    expect(calls).toBe(1);
  });

  it("does not cache an in-flight read that a write invalidated", async () => {
    const cache = new TtlCache(1000);
    const stale = deferred<string>();

    // A poll starts before the write...
    const inflight = cache.wrap("services:list", () => stale.promise);
    // ...a mutation lands and invalidates...
    cache.invalidate("services:");
    // ...and only then does the pre-write read resolve.
    stale.resolve("desiredCount=2");
    expect(await inflight).toBe("desiredCount=2");

    // The stale value must not have been cached: the next read goes upstream.
    const fresh = await cache.wrap("services:list", async () => "desiredCount=4");
    expect(fresh).toBe("desiredCount=4");
  });

  it("invalidate() with no prefix drops everything, including in-flight reads", async () => {
    const cache = new TtlCache(1000);
    const stale = deferred<string>();
    const inflight = cache.wrap("k", () => stale.promise);
    cache.invalidate();
    stale.resolve("old");
    await inflight;
    expect(await cache.wrap("k", async () => "new")).toBe("new");
  });

  it("only invalidates keys matching the prefix", async () => {
    const cache = new TtlCache(1000);
    await cache.wrap("services:list", async () => "s1");
    await cache.wrap("clusters:list", async () => "c1");
    cache.invalidate("services:");
    expect(await cache.wrap("services:list", async () => "s2")).toBe("s2");
    expect(await cache.wrap("clusters:list", async () => "c2")).toBe("c1");
  });
});
