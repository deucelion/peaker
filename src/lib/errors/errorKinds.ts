/**
 * Faz 10.7 — Standartlaştırılmış hata sınıflandırması.
 *
 * Sistem genelinde 4 ana hata kategorisi:
 *  - `user`        → kullanıcıya gösterilebilir (validation, permission, vb.)
 *  - `internal`    → log'a yazılır, kullanıcıya generic mesaj döner
 *  - `transient`   → retryable; queue/job sistemi içinde tekrar denenebilir
 *  - `critical`    → manuel müdahale gerektirir (Sentry critical severity)
 *
 * Bu modül `src/lib/ui/queryState.ts` QueryErrorKind'a paraleldir; ikisi
 * birbirine map edilebilir.
 */

import type { QueryErrorKind } from "@/lib/ui/queryState";

export type ErrorSeverity = "user" | "internal" | "transient" | "critical";

export type RetryClassification = "no_retry" | "retry_safe" | "retry_idempotent_only";

export type AppErrorMeta = {
  /** Sentry severity ve queue retry kararı için. */
  severity: ErrorSeverity;
  /** Queue retry stratejisi. Default `no_retry` (defensive). */
  retry: RetryClassification;
  /** UI'da gösterilecek tone (queryState). */
  uiKind: QueryErrorKind;
  /** İçeride logger.warn/error/critical hangi level kullanılacak. */
  logLevel: "warn" | "error" | "critical";
};

/**
 * Bilinen hata türleri için meta tablo. Yeni türler eklenirken bu tabloya
 * giriş ekleyin; default fallback `internal` olarak set edilir.
 */
export const ERROR_KIND_META: Record<string, AppErrorMeta> = {
  invalid_input: {
    severity: "user",
    retry: "no_retry",
    uiKind: "fetch_error",
    logLevel: "warn",
  },
  permission_denied: {
    severity: "user",
    retry: "no_retry",
    uiKind: "permission_denied",
    logLevel: "warn",
  },
  auth_required: {
    severity: "user",
    retry: "no_retry",
    uiKind: "permission_denied",
    logLevel: "warn",
  },
  not_found: {
    severity: "user",
    retry: "no_retry",
    uiKind: "fetch_error",
    logLevel: "warn",
  },
  schema_drift: {
    severity: "critical",
    retry: "no_retry",
    uiKind: "fetch_error",
    logLevel: "critical",
  },
  fetch_error: {
    severity: "internal",
    retry: "retry_idempotent_only",
    uiKind: "fetch_error",
    logLevel: "error",
  },
  transient_fetch: {
    severity: "transient",
    retry: "retry_safe",
    uiKind: "fetch_error",
    logLevel: "warn",
  },
  db_constraint: {
    severity: "internal",
    retry: "no_retry",
    uiKind: "fetch_error",
    logLevel: "error",
  },
};

export const DEFAULT_ERROR_META: AppErrorMeta = {
  severity: "internal",
  retry: "no_retry",
  uiKind: "fetch_error",
  logLevel: "error",
};

export function resolveErrorMeta(kind: string | null | undefined): AppErrorMeta {
  if (!kind) return DEFAULT_ERROR_META;
  return ERROR_KIND_META[kind] ?? DEFAULT_ERROR_META;
}
