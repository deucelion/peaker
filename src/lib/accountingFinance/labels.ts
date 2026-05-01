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
  return PAYMENT_KIND_LABELS[key] || "Diğer";
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
