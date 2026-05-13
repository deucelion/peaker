/**
 * Faz 8.4 — Standardized action telemetry.
 *
 * Hedef:
 *   - Server action'ları tek bir telemetry formatı ile sarmalamak.
 *   - Request correlation id'sini taşımak (henüz Next.js header'ından okuyacak
 *     hook yok; foundation only).
 *   - Slow action / slow query tespiti için `measureAction` helper.
 *   - PII sanitize devam eder (`logger` üzerinden).
 *
 * Mevcut `withServerActionGuard` korunur; bu modül onun üzerine binilir.
 */

import { randomUUID } from "node:crypto";
import { logger, type LogContext } from "./logger";
import { startTiming } from "./timing";

export type ActionSeverity = "info" | "warn" | "error" | "critical";

const DEFAULT_SLOW_ACTION_MS = 1500;
const DEFAULT_SLOW_QUERY_MS = 800;
const DEFAULT_CRITICAL_MS = 5000;

/**
 * Standardized telemetry envelope for a server action invocation.
 * - `correlationId` her çağrıya özgüdür; hosting platform request id'si
 *   eklemek istenirse `attachCorrelation` ile genişletilebilir.
 */
export type ActionTelemetry = {
  action: string;
  correlationId: string;
  startedAt: number;
  attributes: Record<string, unknown>;
};

export function startActionTelemetry(action: string, seed?: LogContext): ActionTelemetry {
  return {
    action,
    correlationId: randomUUID(),
    startedAt: Date.now(),
    attributes: { ...(seed ?? {}) },
  };
}

/**
 * `measureAction` — bir async iş parçacığını standart telemetry ile sarmalar.
 *
 *  - Slow ise warn log
 *  - Critical eşik aşılırsa error log
 *  - Başarısızlıkta `logger.error` + rethrow
 *
 *  Davranış değişikliği yok; sadece gözlemlenebilirlik.
 */
export async function measureAction<T>(
  action: string,
  fn: () => Promise<T>,
  options?: {
    seed?: LogContext;
    slowMs?: number;
    criticalMs?: number;
  }
): Promise<T> {
  const tel = startActionTelemetry(action, options?.seed);
  const slowMs = options?.slowMs ?? DEFAULT_SLOW_ACTION_MS;
  const criticalMs = options?.criticalMs ?? DEFAULT_CRITICAL_MS;
  try {
    const result = await fn();
    const durationMs = Date.now() - tel.startedAt;
    const ctx: LogContext = {
      correlationId: tel.correlationId,
      durationMs,
      ...tel.attributes,
    };
    if (durationMs >= criticalMs) {
      logger.warn(`${action}.critical_latency`, `action exceeded critical threshold ${durationMs}ms`, ctx);
    } else if (durationMs >= slowMs) {
      logger.warn(`${action}.slow`, `slow action ${durationMs}ms`, ctx);
    } else {
      logger.debug(action, "action ok", ctx);
    }
    return result;
  } catch (err) {
    const durationMs = Date.now() - tel.startedAt;
    logger.error(action, err, {
      correlationId: tel.correlationId,
      durationMs,
      ...tel.attributes,
    });
    throw err;
  }
}

/**
 * `measureQuery` — pure Supabase / DB sorgu telemetry. Slow eşik daha düşük
 * tutuldu (default 800ms).
 */
export function measureQuery<T>(
  scope: string,
  fn: () => Promise<T>,
  options?: { slowMs?: number; context?: LogContext }
): Promise<T> {
  const t = startTiming(`query.${scope}`, { warnAfterMs: options?.slowMs ?? DEFAULT_SLOW_QUERY_MS });
  return fn()
    .then((value) => {
      t.stop(options?.context);
      return value;
    })
    .catch((err) => {
      t.stop({ ...(options?.context ?? {}), failed: true });
      throw err;
    });
}

/**
 * Yeni bir attribute eklemek için telemetry envelope'una ek yapar.
 * PII içermez; orchestration için kullanılır (row count, cap, dataScope...).
 */
export function attachAttribute(tel: ActionTelemetry, key: string, value: unknown): void {
  tel.attributes[key] = value;
}
