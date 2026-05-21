import { isSchemaCompatibilityError } from "@/lib/schemaCompat/errors";
import { operationalError } from "@/lib/ui/operationalErrors";

/** Kullanıcıya ham SQL / kolon adı göstermeden kısa mesaj. */
export function userFacingDataError(prefix: string, rawMessage?: string | null, code?: string): string {
  return operationalError(prefix, { rawMessage, code });
}

export function auditListUserMessage(errorKind: string, serverMessage?: string | null): {
  title: string;
  description: string;
  diagnosticsCode: string;
} {
  const code = `AUD-${errorKind.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  switch (errorKind) {
    case "permission_denied":
      return {
        title: "Audit kayıtlarını görüntüleme yetkiniz yok",
        description: serverMessage || "Bu alan yalnızca yönetici rolleri içindir.",
        diagnosticsCode: code,
      };
    case "auth_required":
      return {
        title: "Oturum gerekli",
        description: serverMessage || "Oturumunuz sona ermiş olabilir.",
        diagnosticsCode: code,
      };
    case "invalid_input":
      return {
        title: "Filtreler geçersiz",
        description: serverMessage || "Tarih veya filtre değerlerini kontrol edin.",
        diagnosticsCode: code,
      };
    case "timeout":
      return {
        title: "Audit sorgusu zaman aşımına uğradı",
        description: "Tarih aralığını daraltıp tekrar deneyin.",
        diagnosticsCode: code,
      };
    default:
      return {
        title: "Audit kayıtları şu anda alınamıyor",
        description:
          serverMessage && !isSchemaCompatibilityError(serverMessage)
            ? serverMessage
            : "Sunucu yanıt vermedi. Bir süre sonra tekrar deneyin.",
        diagnosticsCode: code,
      };
  }
}
