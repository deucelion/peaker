import { normalizeMoney } from "@/lib/privateLessons/packageMath";

/** Gecikmiş / yakın vade eşiği (gün). */
export const RECEIVABLE_DUE_SOON_DAYS = 3;

export type ReceivableComputedStatus =
  | "no_debt"
  | "payment_complete"
  | "payment_pending"
  | "partial_payment"
  | "due_soon"
  | "overdue";

export const RECEIVABLE_STATUS_LABEL_TR: Record<ReceivableComputedStatus, string> = {
  no_debt: "Borç yok",
  payment_complete: "Tahsilat tamamlandı",
  payment_pending: "Ödenmesi gereken tutar bekleniyor",
  partial_payment: "Kısmi tahsilat kaydı",
  due_soon: "Vade yaklaşıyor",
  overdue: "Vadesi geçmiş tahsilat",
};

export const RECEIVABLE_STATUS_TONE: Record<ReceivableComputedStatus, string> = {
  no_debt: "text-gray-300 border-white/10 bg-white/5",
  payment_complete: "text-emerald-200 border-emerald-500/30 bg-emerald-500/10",
  payment_pending: "text-amber-200 border-amber-500/30 bg-amber-500/10",
  partial_payment: "text-sky-200 border-sky-500/30 bg-sky-500/10",
  due_soon: "text-amber-200 border-amber-500/35 bg-amber-500/10",
  overdue: "text-rose-200 border-rose-500/35 bg-rose-500/10",
};

export type ReceivableStatusInput = {
  totalPrice: number;
  amountPaid: number;
  nextPaymentDueAt: string | null | undefined;
  /** Varsayılan: bugün (yerel iş günü değil; UTC date karşılaştırması için) */
  today?: Date;
};

export type ReceivableStatusResult = {
  status: ReceivableComputedStatus;
  label: string;
  tone: string;
  remainingBalance: number;
  daysOverdue: number | null;
  daysUntilDue: number | null;
};

function startOfUtcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function computeReceivableStatus(input: ReceivableStatusInput): ReceivableStatusResult {
  const total = normalizeMoney(input.totalPrice);
  const paid = normalizeMoney(input.amountPaid);
  const remaining = Math.max(0, normalizeMoney(total - paid));
  const today = input.today ?? new Date();
  const todayMs = startOfUtcDay(today);

  if (remaining <= 0.001) {
    return {
      status: paid > 0.001 ? "payment_complete" : "no_debt",
      label: paid > 0.001 ? RECEIVABLE_STATUS_LABEL_TR.payment_complete : RECEIVABLE_STATUS_LABEL_TR.no_debt,
      tone: paid > 0.001 ? RECEIVABLE_STATUS_TONE.payment_complete : RECEIVABLE_STATUS_TONE.no_debt,
      remainingBalance: 0,
      daysOverdue: null,
      daysUntilDue: null,
    };
  }

  const dueRaw = input.nextPaymentDueAt?.trim();
  let daysOverdue: number | null = null;
  let daysUntilDue: number | null = null;

  if (dueRaw && Number.isFinite(Date.parse(dueRaw))) {
    const due = new Date(dueRaw);
    const dueMs = startOfUtcDay(due);
    const diff = Math.round((todayMs - dueMs) / 86_400_000);
    if (diff > 0) daysOverdue = diff;
    else daysUntilDue = -diff;
  }

  if (daysOverdue != null && daysOverdue > 0) {
    return {
      status: "overdue",
      label: RECEIVABLE_STATUS_LABEL_TR.overdue,
      tone: RECEIVABLE_STATUS_TONE.overdue,
      remainingBalance: remaining,
      daysOverdue,
      daysUntilDue: null,
    };
  }

  if (daysUntilDue != null && daysUntilDue <= RECEIVABLE_DUE_SOON_DAYS) {
    return {
      status: "due_soon",
      label: RECEIVABLE_STATUS_LABEL_TR.due_soon,
      tone: RECEIVABLE_STATUS_TONE.due_soon,
      remainingBalance: remaining,
      daysOverdue: null,
      daysUntilDue,
    };
  }

  if (paid <= 0.001) {
    return {
      status: "payment_pending",
      label: RECEIVABLE_STATUS_LABEL_TR.payment_pending,
      tone: RECEIVABLE_STATUS_TONE.payment_pending,
      remainingBalance: remaining,
      daysOverdue,
      daysUntilDue,
    };
  }

  return {
    status: "partial_payment",
    label: RECEIVABLE_STATUS_LABEL_TR.partial_payment,
    tone: RECEIVABLE_STATUS_TONE.partial_payment,
    remainingBalance: remaining,
    daysOverdue,
    daysUntilDue,
  };
}
