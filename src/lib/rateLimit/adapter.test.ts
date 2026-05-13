import { describe, it, expect, beforeEach } from "vitest";
import {
  registerRateLimitAdapter,
  checkRateLimitAsync,
  checkRateLimitDualAsync,
  inMemoryAsyncAdapter,
  __resetRateLimitAdapterForTests,
  type AsyncRateLimitAdapter,
} from "./adapter";
import { __resetRateLimitForTests, type RateLimitDecision, type RateLimitOptions } from "./inMemoryRateLimiter";

describe("checkRateLimitAsync — memory adapter", () => {
  beforeEach(() => {
    __resetRateLimitAdapterForTests();
    __resetRateLimitForTests();
    registerRateLimitAdapter(inMemoryAsyncAdapter, { fallback: inMemoryAsyncAdapter });
  });

  it("returns adapter name on success", async () => {
    const decision = await checkRateLimitAsync("a", { capacity: 2, windowMs: 60_000 });
    expect(decision.adapter).toBe("in-memory");
    expect(decision.allowed).toBe(true);
  });

  it("rejects after capacity exceeded", async () => {
    const opts: RateLimitOptions = { capacity: 1, windowMs: 60_000 };
    expect((await checkRateLimitAsync("b", opts)).allowed).toBe(true);
    const denied = await checkRateLimitAsync("b", opts);
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) {
      expect(denied.retryAfterMs).toBeGreaterThan(0);
    }
  });
});

describe("checkRateLimitAsync — fallback on adapter failure", () => {
  beforeEach(() => {
    __resetRateLimitAdapterForTests();
    __resetRateLimitForTests();
  });

  it("falls back to in-memory when active adapter throws", async () => {
    const flakyAdapter: AsyncRateLimitAdapter = {
      name: "upstash-redis",
      async check(): Promise<RateLimitDecision> {
        throw new Error("redis exploded");
      },
    };
    registerRateLimitAdapter(flakyAdapter, { fallback: inMemoryAsyncAdapter });
    const decision = await checkRateLimitAsync("x", { capacity: 1, windowMs: 60_000 });
    expect(decision.allowed).toBe(true);
    expect(decision.degraded).toBe(true);
    expect(decision.adapter).toBe("in-memory");
  });

  it("returns allow on failure when both adapters fail", async () => {
    const flakyAdapter: AsyncRateLimitAdapter = {
      name: "upstash-redis",
      async check(): Promise<RateLimitDecision> {
        throw new Error("primary explosion");
      },
    };
    const flakyFallback: AsyncRateLimitAdapter = {
      name: "in-memory",
      async check(): Promise<RateLimitDecision> {
        throw new Error("fallback explosion");
      },
    };
    registerRateLimitAdapter(flakyAdapter, { fallback: flakyFallback });
    const decision = await checkRateLimitAsync("x", { capacity: 1, windowMs: 60_000 });
    expect(decision.allowed).toBe(true);
    expect(decision.adapter).toBe("allow_on_failure");
    expect(decision.degraded).toBe(true);
  });

  it("times out slow adapter and falls back", async () => {
    const slowAdapter: AsyncRateLimitAdapter = {
      name: "upstash-redis",
      check: () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ allowed: true, remaining: 5 }), 1000)
        ),
    };
    registerRateLimitAdapter(slowAdapter, { fallback: inMemoryAsyncAdapter });
    const decision = await checkRateLimitAsync(
      "slow",
      { capacity: 5, windowMs: 60_000 },
      { timeoutMs: 50 }
    );
    expect(decision.adapter).toBe("in-memory");
    expect(decision.degraded).toBe(true);
  });
});

describe("checkRateLimitDualAsync", () => {
  beforeEach(() => {
    __resetRateLimitAdapterForTests();
    __resetRateLimitForTests();
    registerRateLimitAdapter(inMemoryAsyncAdapter, { fallback: inMemoryAsyncAdapter });
  });

  it("rejects when user bucket exhausted", async () => {
    const userOpts: RateLimitOptions = { capacity: 1, windowMs: 60_000 };
    const orgOpts: RateLimitOptions = { capacity: 10, windowMs: 60_000 };
    expect((await checkRateLimitDualAsync("u:a", "o:1", userOpts, orgOpts)).allowed).toBe(true);
    const denied = await checkRateLimitDualAsync("u:a", "o:1", userOpts, orgOpts);
    expect(denied.allowed).toBe(false);
  });

  it("rejects when org bucket exhausted", async () => {
    const userOpts: RateLimitOptions = { capacity: 10, windowMs: 60_000 };
    const orgOpts: RateLimitOptions = { capacity: 2, windowMs: 60_000 };
    expect((await checkRateLimitDualAsync("u:a", "o:1", userOpts, orgOpts)).allowed).toBe(true);
    expect((await checkRateLimitDualAsync("u:b", "o:1", userOpts, orgOpts)).allowed).toBe(true);
    const denied = await checkRateLimitDualAsync("u:c", "o:1", userOpts, orgOpts);
    expect(denied.allowed).toBe(false);
  });
});
