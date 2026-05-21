import { isSchemaCompatibilityError } from "@/lib/schemaCompat/errors";

export {
  buildOperationalFailure,
  operationalFailureToClientError,
  createCorrelationId,
  createRequestId,
} from "@/lib/ops/operationalContext";
export type { OperationalFailureEnvelope, OperationalActorScope } from "@/lib/ops/operationalContext";

/** Tanı kodu: FIN-FETCH_ERROR, AUD-TIMEOUT, EXP-RATE_LIMIT vb. */
export function diagnosticsCode(domain: string, kind: string): string {
  const d = domain.trim().toUpperCase().replace(/[^A-Z0-9]/g, "_") || "APP";
  const k = kind.trim().toUpperCase().replace(/[^A-Z0-9]/g, "_") || "ERROR";
  return `${d}-${k}`;
}

/**
 * Kullanıcıya operasyonel mesaj; ham PostgREST/SQL/RPC metni sızdırmaz.
 * Sunucu tarafında `rawMessage` yalnızca log için kullanılmalı.
 */
export function operationalError(
  prefix: string,
  opts?: { rawMessage?: string | null; code?: string }
): string {
  const base = isSchemaCompatibilityError(opts?.rawMessage)
    ? `${prefix}. Sistem şema uyumluluk modunda çalışıyor; yöneticinize veritabanı migration (FAZ 18/19) uygulamasını iletin.`
    : `${prefix}. Lütfen tekrar deneyin veya destek ile iletişime geçin.`;
  if (opts?.code) return `${base} (Tanı: ${opts.code})`;
  return base;
}

/** Ham teknik mesajın kullanıcıya gösterilip gösterilmeyeceği. */
export function isTechnicalErrorMessage(message?: string | null): boolean {
  return isSchemaCompatibilityError(message) || looksLikeInfrastructureError(message);
}

function looksLikeInfrastructureError(message?: string | null): boolean {
  const m = String(message || "").toLowerCase();
  if (!m) return false;
  return (
    m.includes("postgrest") ||
    m.includes("schema cache") ||
    m.includes("could not find") ||
    m.includes("42703") ||
    m.includes("42883") ||
    m.includes("jwt") ||
    m.includes("permission denied for") ||
    (m.includes("column") && m.includes("does not exist")) ||
    m.includes("rpc")
  );
}
