import { createCorrelationId } from "@/lib/ops/operationalContext";
import { diagnosticsCode } from "@/lib/ui/operationalErrors";

export const FIELDTEST_DIAG_SAVE = diagnosticsCode("FIELDTEST", "SAVE");
export const FIELDTEST_DIAG_SCHEMA = diagnosticsCode("FIELDTEST", "SCHEMA");
export const FIELDTEST_DIAG_VALIDATION = diagnosticsCode("FIELDTEST", "VALIDATION");

export type FieldTestSaveFailure = {
  error: string;
  diagnosticsCode: string;
  correlationId: string;
  devHint?: string | null;
};

export function fieldTestSaveFailure(
  userMessage: string,
  opts?: {
    diagnosticsCode?: string;
    rawMessage?: string | null;
    pgCode?: string | null;
  }
): FieldTestSaveFailure {
  const correlationId = createCorrelationId();
  const isDev = process.env.NODE_ENV !== "production";
  const code = opts?.diagnosticsCode ?? FIELDTEST_DIAG_SAVE;
  const friendly = mapFieldTestWriteError(opts?.pgCode, opts?.rawMessage, userMessage);
  return {
    error: `${friendly} (Tanı: ${code})`,
    diagnosticsCode: code,
    correlationId,
    devHint: isDev ? opts?.rawMessage?.slice(0, 500) ?? null : null,
  };
}

export function mapFieldTestWriteError(
  pgCode: string | null | undefined,
  rawMessage: string | null | undefined,
  fallback: string
): string {
  const code = (pgCode || "").toLowerCase();
  const msg = (rawMessage || "").toLowerCase();

  if (code === "42p10" || msg.includes("no unique or exclusion constraint")) {
    return "Saha testi kayıt altyapısı eksik görünüyor. Yöneticinize migration (saha testi conflict index) uygulamasını iletin.";
  }
  if (code === "23505" || msg.includes("duplicate key")) {
    return "Aynı sporcu, metrik ve tarih için yalnızca tek kayıt tutulabilir.";
  }
  if (code === "23502" || msg.includes("not-null") || msg.includes("null value")) {
    return "Metrik değeri veritabanı kuralına uymuyor. Metin metrik migration’ı uygulanmış mı kontrol edin.";
  }
  if (
    code === "42703" ||
    code === "pgrst204" ||
    msg.includes("value_text") ||
    (msg.includes("column") && msg.includes("does not exist")) ||
    msg.includes("schema cache")
  ) {
    return "Saha testi metin alanı (value_text) henüz yok. Veritabanı migration 20260430 uygulanmalı.";
  }
  return fallback;
}
