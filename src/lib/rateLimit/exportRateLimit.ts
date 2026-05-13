/**
 * Faz 11.7 — Export endpoint rate limit policy.
 *
 * Default:
 *   - Per-user: 6 export / 5 dakika
 *   - Per-org:  20 export / 5 dakika
 *
 * Override env:
 *   PEAKER_EXPORT_RATE_USER (default 6)
 *   PEAKER_EXPORT_RATE_ORG  (default 20)
 *   PEAKER_EXPORT_RATE_WINDOW_MS (default 300000)
 */

import { checkRateLimitDual, type RateLimitDecision } from "./inMemoryRateLimiter";
import { checkRateLimitDualAsync } from "./adapter";

function readNum(env: string | undefined, fallback: number): number {
  const n = Number(env);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function getExportRateLimits(): {
  windowMs: number;
  perUser: number;
  perOrg: number;
} {
  return {
    windowMs: readNum(process.env.PEAKER_EXPORT_RATE_WINDOW_MS, 5 * 60 * 1000),
    perUser: readNum(process.env.PEAKER_EXPORT_RATE_USER, 6),
    perOrg: readNum(process.env.PEAKER_EXPORT_RATE_ORG, 20),
  };
}

export function checkExportRateLimit(input: {
  userId: string;
  organizationId: string;
  exportKind: "audit" | "accounting" | "performance" | "field_tests" | string;
}): RateLimitDecision {
  const { windowMs, perUser, perOrg } = getExportRateLimits();
  return checkRateLimitDual(
    { capacity: perUser, windowMs },
    `export:${input.exportKind}:user:${input.userId}`,
    `export:${input.exportKind}:org:${input.organizationId}`,
    { capacity: perOrg, windowMs }
  );
}

/**
 * Faz 12.3 — Async API. Mevcut sync `checkExportRateLimit` aynı policy ile
 * korunur; bu fonksiyon adapter (memory / upstash / postgres) üzerinden
 * çalışır. Yeni call site'larda tercih edilir.
 */
export async function checkExportRateLimitAsync(input: {
  userId: string;
  organizationId: string;
  exportKind: "audit" | "accounting" | "performance" | "field_tests" | string;
}): Promise<RateLimitDecision & { adapter: string; degraded?: boolean }> {
  const { windowMs, perUser, perOrg } = getExportRateLimits();
  return await checkRateLimitDualAsync(
    `export:${input.exportKind}:user:${input.userId}`,
    `export:${input.exportKind}:org:${input.organizationId}`,
    { capacity: perUser, windowMs },
    { capacity: perOrg, windowMs }
  );
}

/**
 * Faz 12.3 — Tüm rate-limited action'larda standart retry-after mesajı.
 * Sync ve async API tüketicileri aynı format'ı görür → UX parity.
 */
export function formatRateLimitRetryMessage(
  decision: RateLimitDecision,
  scope: "audit" | "accounting" | "performance" | "field_tests" | string
): string {
  if (decision.allowed) return "";
  const seconds = Math.max(1, Math.ceil(decision.retryAfterMs / 1000));
  const label = scope === "audit"
    ? "Audit dışa aktarımı"
    : scope === "accounting"
      ? "Tahsilat dışa aktarımı"
      : scope === "performance"
        ? "Performans dışa aktarımı"
        : scope === "field_tests"
          ? "Saha testi dışa aktarımı"
          : "Bu işlem";
  return `${label} için çok fazla istek yapıldı. Lütfen ${seconds} saniye sonra tekrar deneyin.`;
}
