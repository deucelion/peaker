import { getFinanceStatusPresentation } from "@/lib/finance/statusPresentation";

const PAYMENT_KIND_LABELS: Record<string, string> = {
  monthly_membership: "Aylık Üyelik",
  private_lesson_package: "Özel Ders Paketi",
  license: "Lisans",
  event: "Etkinlik",
  equipment: "Ekipman",
  manual_other: "Diğer",
  other: "Diğer",
};

const PAYMENT_SCOPE_LABELS: Record<string, string> = {
  membership: "Üyelik",
  private_lesson: "Özel Ders",
  extra_charge: "Özel tahsilat",
  license: "Lisans",
  event: "Etkinlik",
  equipment: "Ekipman",
  other: "Diğer",
};

const LESSON_TYPE_LABELS: Record<string, string> = {
  group: "Grup Dersi",
  private: "Özel Ders",
};

const LESSON_STATUS_LABELS: Record<string, string> = {
  scheduled: "Planlandı",
  planned: "Planlandı",
  completed: "Tamamlandı",
  cancelled: "İptal Edildi",
};

export function getAccountingPaymentKindLabel(paymentKind: string | null | undefined): string {
  const key = String(paymentKind || "").trim().toLowerCase();
  if (PAYMENT_KIND_LABELS[key]) return PAYMENT_KIND_LABELS[key];
  if (!key) return "Diğer";
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toLocaleUpperCase("tr-TR"));
}

export function getAccountingPaymentScopeLabel(paymentScope: string | null | undefined): string {
  const key = String(paymentScope || "").trim().toLowerCase();
  return PAYMENT_SCOPE_LABELS[key] || "Diğer";
}

export function getAccountingLessonTypeLabel(lessonType: string | null | undefined): string {
  const key = String(lessonType || "").trim().toLowerCase();
  return LESSON_TYPE_LABELS[key] || "Ders";
}

export function getAccountingLessonStatusLabel(lessonStatus: string | null | undefined): string {
  const key = String(lessonStatus || "").trim().toLowerCase();
  return LESSON_STATUS_LABELS[key] || "Planlandı";
}

export function getAccountingPaymentStatusLabel(status: "bekliyor" | "odendi"): string {
  if (status === "odendi") {
    return getFinanceStatusPresentation({ label: "Ödeme Tamamlandı" }).label;
  }
  return getFinanceStatusPresentation({ label: "Ödeme Bekleniyor" }).label;
}

/** Tablo satırı: paket kısmi ödemesinde ödeme kaydı `odendi` olsa da kalan bakiye varsa ayrı etiket. */
export function getAccountingPaymentRowStatusLabel(row: {
  status: "bekliyor" | "odendi";
  packageId: string | null;
  remainingBalance: number | null;
}): string {
  if (row.status === "bekliyor") return getAccountingPaymentStatusLabel("bekliyor");
  if (row.packageId && row.remainingBalance != null && row.remainingBalance > 0.001) {
    return "Kısmi ödeme (paket)";
  }
  return getAccountingPaymentStatusLabel("odendi");
}

export function getAccountingPaymentRowStatusBadgeClass(row: {
  status: "bekliyor" | "odendi";
  packageId: string | null;
  remainingBalance: number | null;
}): string {
  if (row.status === "bekliyor") {
    return "border-amber-500/35 bg-amber-500/10 text-amber-200";
  }
  if (row.packageId && row.remainingBalance != null && row.remainingBalance > 0.001) {
    return "border-amber-500/35 bg-amber-500/10 text-amber-200";
  }
  return "border-emerald-500/35 bg-emerald-500/10 text-emerald-200";
}

export function getAccountingCoachPayoutTrackingLabel(
  status: "eligible" | "included" | "paid" | null,
  isEligible: boolean
): string {
  if (!isEligible) return "Uygun Değil";
  if (status === "paid") return "Koç Ödemesi Tamamlandı";
  if (status === "included") return "Koç Ödemesi Listesine Alındı";
  return "Ödeme Bekliyor";
}

export function getAccountingPayoutCalculationLabel(
  status: "ok" | "no_rule" | "no_price" | "not_eligible"
): string {
  if (status === "ok") return "Hesaplandı";
  if (status === "no_rule") return "Kural Tanımsız";
  if (status === "no_price") return "Ders Ücreti Tanımsız";
  return "Uygun Değil";
}
