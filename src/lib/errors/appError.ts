/**
 * Faz 10.7 — `AppError` standart hata sınıfı.
 *
 * Mevcut server action sözleşmesi `{ error: string, errorKind?: string }`
 * kullanıyor; bu kalıbı bozmamak için `AppError` instance'ı `toServerResult()`
 * ile bu shape'i üretebilir. Tersine, mevcut response'lar `fromServerResult()`
 * ile `AppError`'a parse edilebilir (retry kararı için).
 *
 * Kullanım:
 *   throw new AppError("permission_denied", "Bu kaynağa erişiminiz yok.");
 *   return AppError.user("invalid_input", "Tarih biçimi geçersiz.").toServerResult();
 */

import { resolveErrorMeta, type AppErrorMeta } from "./errorKinds";

export type AppErrorOptions = {
  kind: string;
  message: string;
  cause?: unknown;
  attributes?: Record<string, unknown>;
};

export class AppError extends Error {
  readonly kind: string;
  readonly attributes?: Record<string, unknown>;
  readonly cause?: unknown;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.kind = options.kind;
    this.cause = options.cause;
    this.attributes = options.attributes;
  }

  get meta(): AppErrorMeta {
    return resolveErrorMeta(this.kind);
  }

  toServerResult(): { error: string; errorKind: string } {
    return { error: this.message, errorKind: this.kind };
  }

  static user(kind: "invalid_input" | "permission_denied" | "auth_required" | "not_found", message: string, attributes?: Record<string, unknown>) {
    return new AppError({ kind, message, attributes });
  }

  static internal(message: string, cause?: unknown, attributes?: Record<string, unknown>) {
    return new AppError({ kind: "fetch_error", message, cause, attributes });
  }

  static transient(message: string, cause?: unknown, attributes?: Record<string, unknown>) {
    return new AppError({ kind: "transient_fetch", message, cause, attributes });
  }

  static critical(kind: "schema_drift", message: string, attributes?: Record<string, unknown>) {
    return new AppError({ kind, message, attributes });
  }

  static fromUnknown(value: unknown, fallbackKind: string = "fetch_error", fallbackMessage: string = "Beklenmeyen bir hata oluştu."): AppError {
    if (value instanceof AppError) return value;
    if (value instanceof Error) {
      return new AppError({ kind: fallbackKind, message: value.message || fallbackMessage, cause: value });
    }
    if (typeof value === "string") {
      return new AppError({ kind: fallbackKind, message: value });
    }
    return new AppError({ kind: fallbackKind, message: fallbackMessage });
  }
}

/** Server-action result `{ error, errorKind? }` shape'inden AppError üret. */
export function appErrorFromResult(result: { error: string; errorKind?: string | null }): AppError {
  return new AppError({
    kind: result.errorKind ?? "fetch_error",
    message: result.error,
  });
}
