/**
 * Faz 7.5 — Structured server-side logger.
 *
 * Hedef:
 *   - Tüm server action ve retention job'lar için tek format.
 *   - JSON-uyumlu yapısal log (hosting drain'leri kolay parse eder).
 *   - PII içermez (id'leri opaque tut; full_name / email yazma).
 *   - Mevcut `console.error` çağrılarını kademeli olarak buraya migrate.
 *
 * Kullanım:
 *   logger.info("payments.export", { rowCount, truncated });
 *   logger.warn("retention.notifications", { deletedCount });
 *   logger.error("performance.export", err, { athleteCount });
 */

import { captureServerActionError, captureServerActionSignal } from "@/lib/observability/serverActionError";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

/**
 * Production-safe log emitter.
 * Browser'da çalıştırmaya değer durumlarda da bozulmaz (no-op'a düşmez,
 * sadece console output'u kalır).
 */
function emit(level: LogLevel, scope: string, message: string, context?: LogContext) {
  const ts = new Date().toISOString();
  const safeContext = sanitizeContext(context);
  const payload = {
    ts,
    level,
    scope,
    msg: message,
    ...safeContext,
  };
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else if (level === "debug") {
    if (process.env.NODE_ENV !== "production") console.debug(line);
  } else {
    console.log(line);
  }
}

/**
 * Context değerlerinden tahmini PII'yi düşürür.
 * - "full_name" / "email" / "phone" alanlarını maskeler.
 * - Diğer string'leri 200 karakter ile sınırlar.
 */
function sanitizeContext(context: LogContext | undefined): LogContext {
  if (!context) return {};
  const out: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    if (/email|full_name|phone|address|password/i.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    if (typeof value === "string" && value.length > 200) {
      out[key] = `${value.slice(0, 200)}…`;
      continue;
    }
    out[key] = value;
  }
  return out;
}

export const logger = {
  debug(scope: string, message: string, context?: LogContext) {
    emit("debug", scope, message, context);
  },
  info(scope: string, message: string, context?: LogContext) {
    emit("info", scope, message, context);
  },
  warn(scope: string, message: string, context?: LogContext) {
    emit("warn", scope, message, context);
    captureServerActionSignal(scope, message, sanitizeContext(context));
  },
  /**
   * Beklenmeyen runtime hatasını yakalar ve Sentry'ye iletir.
   * Sentry runtime kapalıysa sadece structured log çıkar.
   */
  error(scope: string, err: unknown, context?: LogContext) {
    const error = err instanceof Error ? err : new Error(String(err));
    emit("error", scope, error.message, { ...context, stack: error.stack });
    captureServerActionError(scope, error, sanitizeContext(context));
  },
};
