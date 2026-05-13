/**
 * Faz 12.3 — Upstash Redis adapter (REST API).
 *
 * Sliding-window token-bucket algoritması Redis tek round-trip Lua script
 * ile çalıştırılır. Vercel-Upstash same region latency ~30-80ms median.
 *
 * Kararlar:
 *   - HTTP REST (no TCP client) — Vercel serverless'ta safest.
 *   - Lua script atomic; race condition yok.
 *   - Allow on adapter failure (no accidental blocking) — caller'da
 *     `checkRateLimitAsync` zaten fallback yapar.
 *
 * ENV gereksinim:
 *   UPSTASH_REDIS_REST_URL    https://xxx.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN  AbcD...
 *
 * Konfigürasyon yoksa adapter `null` döner ve setup in-memory'de kalır.
 */

import type { AsyncRateLimitAdapter } from "./adapter";
import type { RateLimitDecision, RateLimitOptions } from "./inMemoryRateLimiter";

const LUA_TOKEN_BUCKET = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local refillRatePerMs = capacity / windowMs

local state = redis.call('HMGET', key, 'tokens', 'lastRefillTs')
local tokens = tonumber(state[1])
local lastRefillTs = tonumber(state[2])

if tokens == nil or lastRefillTs == nil then
  tokens = capacity - 1
  redis.call('HMSET', key, 'tokens', tokens, 'lastRefillTs', now)
  redis.call('PEXPIRE', key, windowMs * 2)
  return {1, math.floor(tokens), 0}
end

local elapsed = math.max(0, now - lastRefillTs)
local refilled = math.min(capacity, tokens + elapsed * refillRatePerMs)
if refilled >= 1 then
  local newTokens = refilled - 1
  redis.call('HMSET', key, 'tokens', newTokens, 'lastRefillTs', now)
  redis.call('PEXPIRE', key, windowMs * 2)
  return {1, math.floor(newTokens), 0}
else
  local missing = 1 - refilled
  local retryAfterMs = math.ceil(missing / refillRatePerMs)
  return {0, 0, retryAfterMs}
end
`.trim();

type UpstashResult = number | string | null;

type UpstashEvalResponse = {
  result?: UpstashResult[];
  error?: string;
};

export function createUpstashAdapter(opts?: {
  url?: string;
  token?: string;
  fetchImpl?: typeof fetch;
}): AsyncRateLimitAdapter | null {
  const url = opts?.url ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = opts?.token ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const normalizedUrl = url.endsWith("/") ? url.slice(0, -1) : url;

  return {
    name: "upstash-redis" as const,
    async check(key: string, options: RateLimitOptions): Promise<RateLimitDecision> {
      const now = Date.now();
      // Upstash REST eval endpoint:
      //   POST {url}/eval/{script}/{numkeys}
      //     body: [key1, key2, ..., arg1, arg2, ...]
      // Daha güvenli pattern: POST {url}/pipeline ile EVAL komutu.
      const body = JSON.stringify([
        "EVAL",
        LUA_TOKEN_BUCKET,
        "1",
        `peaker:rl:${key}`,
        String(options.capacity),
        String(options.windowMs),
        String(now),
      ]);
      const response = await fetchImpl(normalizedUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        throw new Error(`upstash http ${response.status}: ${text}`);
      }
      const payload = (await response.json()) as UpstashEvalResponse;
      if (payload.error) {
        throw new Error(`upstash eval error: ${payload.error}`);
      }
      const arr = Array.isArray(payload.result) ? payload.result : [];
      const allowed = Number(arr[0]) === 1;
      const remaining = Number(arr[1] ?? 0) || 0;
      const retryAfterMs = Number(arr[2] ?? 0) || 0;
      if (allowed) return { allowed: true, remaining };
      return { allowed: false, retryAfterMs, remaining: 0 };
    },
  };
}
