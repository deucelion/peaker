/**
 * Faz 12.3 — Rate limit adapter interface (distributed-ready).
 *
 * Faz 14.2 — Runtime metrikleri: fallback / degraded / çift backend hatası.
 */

import { logger } from "@/lib/monitoring/logger";
import {
  checkRateLimit as inMemoryCheck,
  type RateLimitDecision,
  type RateLimitOptions,
} from "./inMemoryRateLimiter";

export type AsyncRateLimitAdapter = {
  readonly name: "in-memory" | "upstash-redis" | "postgres";
  check(key: string, options: RateLimitOptions): Promise<RateLimitDecision>;
};

export const inMemoryAsyncAdapter: AsyncRateLimitAdapter = {
  name: "in-memory",
  async check(key: string, options: RateLimitOptions): Promise<RateLimitDecision> {
    return inMemoryCheck(key, options);
  },
};

let activeAdapter: AsyncRateLimitAdapter = inMemoryAsyncAdapter;
let fallbackAdapter: AsyncRateLimitAdapter = inMemoryAsyncAdapter;
let setupRan = false;

const ADAPTER_SWITCH_HISTORY_CAP = 20;
const adapterSwitchHistory: Array<{ switchedAt: string; active: string; fallback: string }> = [];

/** Faz 14.2 — Process-lifetime counters (multi-instance: per instance). */
let limiterFallbackCount = 0;
let limiterDegradedHits = 0;
let limiterUnhealthyBackendHits = 0;
let lastLimiterFailureReason: string | null = null;

export function getRateLimiterRuntimeMetrics(): {
  limiterFallbackCount: number;
  limiterDegradedHits: number;
  limiterUnhealthyBackendHits: number;
  lastLimiterFailureReason: string | null;
  activeAdapter: string;
  fallbackAdapter: string;
  recentAdapterSwitches: ReadonlyArray<{ switchedAt: string; active: string; fallback: string }>;
} {
  return {
    limiterFallbackCount,
    limiterDegradedHits,
    limiterUnhealthyBackendHits,
    lastLimiterFailureReason,
    activeAdapter: activeAdapter.name,
    fallbackAdapter: fallbackAdapter.name,
    recentAdapterSwitches: [...adapterSwitchHistory],
  };
}

export function __resetRateLimiterRuntimeMetricsForTests(): void {
  limiterFallbackCount = 0;
  limiterDegradedHits = 0;
  limiterUnhealthyBackendHits = 0;
  lastLimiterFailureReason = null;
  adapterSwitchHistory.length = 0;
}

export function registerRateLimitAdapter(
  adapter: AsyncRateLimitAdapter,
  options?: { fallback?: AsyncRateLimitAdapter }
): void {
  const prevActive = activeAdapter.name;
  const prevFallback = fallbackAdapter.name;
  activeAdapter = adapter;
  if (options?.fallback) fallbackAdapter = options.fallback;
  logger.info("rate_limit.setup", "adapter registered", {
    adapter: adapter.name,
    fallback: fallbackAdapter.name,
  });
  if (prevActive !== adapter.name || prevFallback !== fallbackAdapter.name) {
    adapterSwitchHistory.push({
      switchedAt: new Date().toISOString(),
      active: adapter.name,
      fallback: fallbackAdapter.name,
    });
    while (adapterSwitchHistory.length > ADAPTER_SWITCH_HISTORY_CAP) {
      adapterSwitchHistory.shift();
    }
    logger.info("telemetry.rate_limit.adapter_switch", "limiter stack updated", {
      fromActive: prevActive,
      toActive: adapter.name,
      fallback: fallbackAdapter.name,
    });
  }
}

export function getActiveAdapter(): AsyncRateLimitAdapter {
  return activeAdapter;
}

export function getFallbackAdapter(): AsyncRateLimitAdapter {
  return fallbackAdapter;
}

export async function checkRateLimitAsync(
  key: string,
  options: RateLimitOptions,
  opts?: { timeoutMs?: number }
): Promise<RateLimitDecision & { adapter: string; degraded?: boolean }> {
  const timeoutMs = opts?.timeoutMs ?? 300;
  const adapter = activeAdapter;

  try {
    const decision = await withTimeout(adapter.check(key, options), timeoutMs);
    return { ...decision, adapter: adapter.name };
  } catch (err) {
    limiterFallbackCount += 1;
    lastLimiterFailureReason = (err as Error).message;
    logger.warn("rate_limit.adapter", "active adapter failed; falling back", {
      adapter: adapter.name,
      key,
      reason: (err as Error).message,
    });
  }

  try {
    const decision = await fallbackAdapter.check(key, options);
    limiterDegradedHits += 1;
    return { ...decision, adapter: fallbackAdapter.name, degraded: true };
  } catch (err) {
    limiterUnhealthyBackendHits += 1;
    lastLimiterFailureReason = (err as Error).message;
    logger.warn("rate_limit.adapter", "fallback adapter also failed; allowing", {
      fallback: fallbackAdapter.name,
      key,
      reason: (err as Error).message,
    });
    return {
      allowed: true,
      remaining: options.capacity,
      adapter: "allow_on_failure",
      degraded: true,
    };
  }
}

export async function checkRateLimitDualAsync(
  userKey: string,
  orgKey: string,
  userOptions: RateLimitOptions,
  orgOptions: RateLimitOptions
): Promise<RateLimitDecision & { adapter: string; degraded?: boolean }> {
  const userDecision = await checkRateLimitAsync(userKey, userOptions);
  if (!userDecision.allowed) return userDecision;
  const orgDecision = await checkRateLimitAsync(orgKey, orgOptions);
  if (!orgDecision.allowed) return orgDecision;
  const remaining = Math.min(userDecision.remaining, orgDecision.remaining);
  const adapter = userDecision.adapter === orgDecision.adapter ? userDecision.adapter : "mixed";
  return {
    allowed: true,
    remaining,
    adapter,
    degraded: userDecision.degraded || orgDecision.degraded,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`adapter timeout ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

export function __resetRateLimitAdapterForTests(): void {
  activeAdapter = inMemoryAsyncAdapter;
  fallbackAdapter = inMemoryAsyncAdapter;
  setupRan = false;
  __resetRateLimiterRuntimeMetricsForTests();
}

export function ensureRateLimitAdapterSetup(setup: () => void): void {
  if (setupRan) return;
  setupRan = true;
  setup();
}
