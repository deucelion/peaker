/**
 * Faz 12.3 — Postgres tabanlı rate limit adapter.
 *
 * RPC: `peaker_rate_limit_check(p_key, p_capacity, p_window_ms)`
 *   returns (allowed boolean, remaining int, retry_after_ms int)
 *
 * Tradeoff:
 *   - Upstash'a göre 2-5x daha yavaş (DB roundtrip).
 *   - Yeni external dep yok (mevcut Supabase'i kullanır).
 *   - Atomic; multi-instance'ta korelasyon sorunu yok.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AsyncRateLimitAdapter } from "./adapter";
import type { RateLimitDecision, RateLimitOptions } from "./inMemoryRateLimiter";

export function createPostgresAdapter(opts?: {
  client?: SupabaseClient;
}): AsyncRateLimitAdapter {
  const lazyClient = (): SupabaseClient => opts?.client ?? createSupabaseAdminClient();
  return {
    name: "postgres" as const,
    async check(key: string, options: RateLimitOptions): Promise<RateLimitDecision> {
      const client = lazyClient();
      const { data, error } = await client.rpc("peaker_rate_limit_check", {
        p_key: key,
        p_capacity: options.capacity,
        p_window_ms: options.windowMs,
      });
      if (error) {
        throw new Error(`postgres rate-limit rpc error: ${error.message}`);
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        throw new Error("postgres rate-limit rpc returned empty");
      }
      const allowed = Boolean(
        (row as { allowed?: boolean | string | null }).allowed === true ||
          (row as { allowed?: boolean | string | null }).allowed === "true" ||
          (row as { allowed?: boolean | string | null }).allowed === "t"
      );
      const remaining = Number((row as { remaining?: number | string | null }).remaining ?? 0) || 0;
      const retryAfterMs =
        Number((row as { retry_after_ms?: number | string | null }).retry_after_ms ?? 0) || 0;
      if (allowed) return { allowed: true, remaining };
      return { allowed: false, retryAfterMs, remaining: 0 };
    },
  };
}
