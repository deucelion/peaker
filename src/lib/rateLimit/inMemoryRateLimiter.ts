/**
 * Faz 11.7 — Lightweight in-memory token-bucket rate limiter.
 *
 * Hedef:
 *   - Export action'larında ve analytics-heavy endpoint'lerde accidental
 *     spam'i engellemek.
 *   - Per-user ve per-org sınırlar.
 *   - Burst protection (kısa pencerede yoğun istek).
 *
 * Sınırlar:
 *   - Vercel serverless'ta her instance kendi memory'sini taşır. Bu yüzden
 *     bu limiter "best-effort" düzeyindedir; %100 garanti değildir. Faz 12'de
 *     Redis/Upstash veya pgmq tabanlı dağıtık limiter ile değiştirilebilir.
 *   - Mevcut server action'lar bu helper'ı opt-in kullanır; default off.
 *
 * Davranış:
 *   - `check(key, options)` her çağrıda tokenları yenileyip kararı döner.
 *   - Karar `allowed` veya `retryAfterMs` içerir.
 */

import { logger } from "@/lib/monitoring/logger";

export type RateLimitDecision =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterMs: number; remaining: number };

export type RateLimitOptions = {
  /** Pencere içinde izin verilen toplam token sayısı. */
  capacity: number;
  /** Pencere uzunluğu (ms). Token bu sürede tamamen yenilenir. */
  windowMs: number;
};

type BucketState = {
  tokens: number;
  lastRefillTs: number;
};

const buckets = new Map<string, BucketState>();

export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitDecision {
  const now = Date.now();
  const state = buckets.get(key);
  const refillRatePerMs = options.capacity / options.windowMs;
  if (!state) {
    buckets.set(key, { tokens: options.capacity - 1, lastRefillTs: now });
    return { allowed: true, remaining: options.capacity - 1 };
  }
  const elapsed = now - state.lastRefillTs;
  const refilled = Math.min(options.capacity, state.tokens + elapsed * refillRatePerMs);
  if (refilled >= 1) {
    state.tokens = refilled - 1;
    state.lastRefillTs = now;
    buckets.set(key, state);
    return { allowed: true, remaining: Math.floor(state.tokens) };
  }
  // 1 token gelmesi için kaç ms gerekli?
  const missing = 1 - refilled;
  const retryAfterMs = Math.ceil(missing / refillRatePerMs);
  logger.warn("rate_limit", "throttled", {
    key,
    retryAfterMs,
    capacity: options.capacity,
    windowMs: options.windowMs,
  });
  return { allowed: false, retryAfterMs, remaining: 0 };
}

/** Yardımcı: per-user + per-org çift kontrol. İkisinden biri reddederse karar reject. */
export function checkRateLimitDual(
  options: RateLimitOptions,
  perUserKey: string,
  perOrgKey: string,
  orgOptions?: RateLimitOptions
): RateLimitDecision {
  const userDecision = checkRateLimit(perUserKey, options);
  if (!userDecision.allowed) return userDecision;
  const orgDecision = checkRateLimit(perOrgKey, orgOptions ?? options);
  if (!orgDecision.allowed) {
    return orgDecision;
  }
  // İki bucket'tan da geçti; en sıkı remaining'i döndür.
  return {
    allowed: true,
    remaining: Math.min(userDecision.remaining, orgDecision.remaining),
  };
}

/** Test/debug için bucket sıfırlama. */
export function __resetRateLimitForTests(): void {
  buckets.clear();
}
