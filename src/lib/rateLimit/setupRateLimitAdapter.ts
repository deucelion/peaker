/**
 * Faz 12.3 — Rate limit adapter setup.
 *
 * ENV:
 *   PEAKER_RATE_LIMIT_BACKEND = memory | upstash | postgres
 *   Default: memory
 *
 * Setup'ı çağıran code path:
 *   - /api/jobs/process route handler (cold start)
 *   - Export action'lar (lazy, ilk çağrıda)
 *
 * Backward-compatible:
 *   - Default memory davranışı mevcut sync limiter ile aynı (best-effort,
 *     per-instance).
 *   - Upstash veya postgres seçilirse adapter init başarısız olduğunda
 *     memory'ye düşülür (no accidental blocking).
 */

import { logger } from "@/lib/monitoring/logger";
import {
  inMemoryAsyncAdapter,
  registerRateLimitAdapter,
  ensureRateLimitAdapterSetup,
  type AsyncRateLimitAdapter,
} from "./adapter";
import { createUpstashAdapter } from "./upstashAdapter";
import { createPostgresAdapter } from "./postgresAdapter";

function chooseAdapter(): { active: AsyncRateLimitAdapter; choiceReason: string } {
  const choice = (process.env.PEAKER_RATE_LIMIT_BACKEND || "").trim().toLowerCase();
  if (choice === "upstash") {
    const upstash = createUpstashAdapter();
    if (upstash) {
      return { active: upstash, choiceReason: "upstash configured" };
    }
    logger.warn("rate_limit.setup", "PEAKER_RATE_LIMIT_BACKEND=upstash but ENV missing; using memory", {
      hasUrl: Boolean(process.env.UPSTASH_REDIS_REST_URL),
      hasToken: Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
    });
  }
  if (choice === "postgres") {
    const pg = createPostgresAdapter();
    return { active: pg, choiceReason: "postgres adapter" };
  }
  return { active: inMemoryAsyncAdapter, choiceReason: "memory (default)" };
}

export function ensureRateLimitSetup(): void {
  ensureRateLimitAdapterSetup(() => {
    const { active, choiceReason } = chooseAdapter();
    registerRateLimitAdapter(active, { fallback: inMemoryAsyncAdapter });
    logger.info("rate_limit.setup", "rate-limit adapter init", {
      adapter: active.name,
      fallback: "in-memory",
      reason: choiceReason,
    });
  });
}
