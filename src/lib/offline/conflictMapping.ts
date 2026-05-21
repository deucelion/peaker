import type { OfflineActionKind, OfflineActionStatus } from "@/lib/offline/types";

export type ReplayFailureKind =
  | "success"
  | "retryable_error"
  | "conflict"
  | "permission_denied"
  | "validation_error"
  | "stale_data";

export function classifyReplayFailure(message: string): ReplayFailureKind {
  const m = message.toLowerCase();
  if (/yetkiniz|yetki|permission|unauthorized|403/.test(m)) return "permission_denied";
  if (/zaten|bugün|kayıt|conflict|çakış|duplicate|mevcut/.test(m)) return "conflict";
  if (/geçersiz|invalid|validation|zorunlu|aralık|eksik/.test(m)) return "validation_error";
  if (/stale|güncel değil|eskimiş|silinmiş|bulunamadı/.test(m)) return "stale_data";
  return "retryable_error";
}

export function statusFromFailureKind(kind: ReplayFailureKind): OfflineActionStatus {
  if (kind === "conflict") return "conflict";
  if (kind === "permission_denied" || kind === "validation_error" || kind === "stale_data") {
    return "failed";
  }
  return "failed";
}

const UI_BY_KIND: Record<ReplayFailureKind, { label: string; hint: string }> = {
  success: { label: "Senkronize edildi", hint: "" },
  retryable_error: {
    label: "Tekrar dene",
    hint: "Bağlantı veya geçici hata. İşlem kuyrukta kaldı.",
  },
  conflict: {
    label: "Çakışma var",
    hint: "Sunucuda zaten kayıt var. Ekrandan kontrol edip gerekirse silin.",
  },
  permission_denied: {
    label: "Yetki yok",
    hint: "Bu işlem için yetkiniz yok. Kuyruktan kaldırıp ekranda tekrar yapın.",
  },
  validation_error: {
    label: "Doğrulama hatası",
    hint: "Veri geçersiz. Formu düzeltip yeniden kaydedin.",
  },
  stale_data: {
    label: "Eski veri",
    hint: "Kayıt güncellenmiş veya silinmiş. Ekranda tekrar yapın.",
  },
};

export function conflictUiForMessage(message: string | null | undefined) {
  const kind = message ? classifyReplayFailure(message) : "retryable_error";
  return { kind, ...UI_BY_KIND[kind] };
}

export function conflictUiForActionKind(kind: OfflineActionKind, message: string | null | undefined) {
  const base = conflictUiForMessage(message);
  if (base.kind !== "conflict") return base;
  if (kind === "wellness_draft") {
    return {
      ...base,
      hint: "Bugün için sabah raporu zaten kayıtlı olabilir. Raporu kontrol edin veya kuyruktan silin.",
    };
  }
  if (kind === "rpe_draft") {
    return {
      ...base,
      hint: "Bu tarih için RPE zaten girilmiş olabilir. Anket ekranından kontrol edin.",
    };
  }
  if (kind === "attendance_draft") {
    return {
      ...base,
      hint: "Ders durumu değişmiş olabilir. Dersi tekrar açarak kontrol edin.",
    };
  }
  if (kind === "field_test_draft") {
    return {
      ...base,
      hint: "Bu tarih için saha testi sunucuda güncellenmiş olabilir. Saha testleri ekranından kontrol edin.",
    };
  }
  if (kind === "coach_note_draft") {
    return {
      ...base,
      hint: "Benzer bir not zaten kayıtlı olabilir. Notlar ekranından kontrol edin.",
    };
  }
  return base;
}
