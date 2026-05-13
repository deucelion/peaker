import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  checkRateLimitDual,
  __resetRateLimitForTests,
} from "./inMemoryRateLimiter";

describe("checkRateLimit — single bucket", () => {
  beforeEach(() => __resetRateLimitForTests());

  it("allows up to capacity calls", () => {
    const opts = { capacity: 3, windowMs: 60_000 };
    expect(checkRateLimit("k", opts).allowed).toBe(true);
    expect(checkRateLimit("k", opts).allowed).toBe(true);
    expect(checkRateLimit("k", opts).allowed).toBe(true);
    const denied = checkRateLimit("k", opts);
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) expect(denied.retryAfterMs).toBeGreaterThan(0);
  });

  it("isolates buckets per key", () => {
    const opts = { capacity: 1, windowMs: 60_000 };
    expect(checkRateLimit("user:a", opts).allowed).toBe(true);
    expect(checkRateLimit("user:b", opts).allowed).toBe(true);
    expect(checkRateLimit("user:a", opts).allowed).toBe(false);
  });
});

describe("checkRateLimitDual — user + org", () => {
  beforeEach(() => __resetRateLimitForTests());

  it("rejects when user bucket exhausted", () => {
    const userOpts = { capacity: 1, windowMs: 60_000 };
    const orgOpts = { capacity: 10, windowMs: 60_000 };
    expect(checkRateLimitDual(userOpts, "u:a", "o:1", orgOpts).allowed).toBe(true);
    expect(checkRateLimitDual(userOpts, "u:a", "o:1", orgOpts).allowed).toBe(false);
  });

  it("rejects when org bucket exhausted", () => {
    const userOpts = { capacity: 10, windowMs: 60_000 };
    const orgOpts = { capacity: 2, windowMs: 60_000 };
    expect(checkRateLimitDual(userOpts, "u:a", "o:1", orgOpts).allowed).toBe(true);
    expect(checkRateLimitDual(userOpts, "u:b", "o:1", orgOpts).allowed).toBe(true);
    expect(checkRateLimitDual(userOpts, "u:c", "o:1", orgOpts).allowed).toBe(false);
  });
});
