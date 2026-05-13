/**
 * Faz 7.5 — Slow query / slow action timing helper.
 *
 * Hedef:
 *   - Belirli bir scope için duration ölçer.
 *   - Eşiği aşan durumlarda structured log'a düşer.
 *   - Hot path performansını bozmamak için Sentry'ye sadece warn olarak iletir.
 *
 * Kullanım:
 *   const t = startTiming("performance.exportSummary");
 *   ... iş ...
 *   t.stop({ rowCount });
 *
 *   ya da:
 *   await measure("performance.exportSummary", async () => { ... }, { rowCount });
 */

import { logger } from "./logger";

const DEFAULT_WARN_MS = 1500;

export function startTiming(scope: string, options?: { warnAfterMs?: number }) {
  const startedAt = Date.now();
  const warnAfter = options?.warnAfterMs ?? DEFAULT_WARN_MS;
  return {
    stop(context?: Record<string, unknown>) {
      const durationMs = Date.now() - startedAt;
      const enriched = { durationMs, ...context };
      if (durationMs >= warnAfter) {
        logger.warn(`${scope}.slow`, `slow operation ${durationMs}ms`, enriched);
      } else {
        logger.debug(scope, "completed", enriched);
      }
      return durationMs;
    },
  };
}

export async function measure<T>(
  scope: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>,
  options?: { warnAfterMs?: number }
): Promise<T> {
  const t = startTiming(scope, options);
  try {
    const result = await fn();
    t.stop(context);
    return result;
  } catch (err) {
    t.stop({ ...context, failed: true });
    throw err;
  }
}
