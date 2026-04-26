import type { PaymentRow } from "@/types/domain";
import type { FinanceStatusSummary } from "@/lib/types/finance";

const DAY_MS = 24 * 60 * 60 * 1000;

function dateOnlyMs(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).getTime();
}

function todayDateOnlyMs() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

export function computeFinanceStatusSummary(input: {
  aidatPayments: PaymentRow[];
  plannedNextDueDate?: string | null;
  plannedNextAmount?: number | null;
  hasPartialPackagePayment?: boolean;
}): FinanceStatusSummary {
  const aidat = (input.aidatPayments || []).filter((p) => p.payment_type === "aylik");
  const pending = aidat.filter((p) => p.status !== "odendi");
  const todayMs = todayDateOnlyMs();

  const withDue = pending.filter((p) => Boolean(p.due_date)).sort((a, b) => dateOnlyMs(a.due_date!) - dateOnlyMs(b.due_date!));
  const overdueRows = withDue.filter((p) => dateOnlyMs(p.due_date!) < todayMs);
  const futureOrTodayRows = withDue.filter((p) => dateOnlyMs(p.due_date!) >= todayMs);

  let nextDueDate: string | null = futureOrTodayRows[0]?.due_date || null;
  let nextAmount: number | null = futureOrTodayRows[0]?.amount ?? null;

  const usedPlannedFallback = !nextDueDate && Boolean(input.plannedNextDueDate);
  if (usedPlannedFallback && input.plannedNextDueDate) {
    nextDueDate = input.plannedNextDueDate;
    nextAmount = input.plannedNextAmount ?? null;
  }

  if (overdueRows.length > 0) {
    return {
      tone: "overdue",
      label: "Gecikmiş Ödeme Var",
      nextDueDate: overdueRows[0]?.due_date || nextDueDate,
      nextAmount: overdueRows[0]?.amount ?? nextAmount,
      overdueCount: overdueRows.length,
      pendingCount: pending.length,
    };
  }

  if (nextDueDate) {
    const nextMs = dateOnlyMs(nextDueDate);
    const days = Math.floor((nextMs - todayMs) / DAY_MS);
    if (days >= 0 && days <= 3) {
      return {
        tone: "approaching",
        label: "Ödeme Bekleniyor",
        nextDueDate,
        nextAmount,
        overdueCount: 0,
        pendingCount: pending.length,
      };
    }
    if (days < 0) {
      return {
        tone: "overdue",
        label: "Gecikmiş Ödeme Var",
        nextDueDate,
        nextAmount,
        overdueCount: 1,
        pendingCount: pending.length,
      };
    }
  }

  if (pending.length > 0 || input.hasPartialPackagePayment) {
    return {
      tone: "paid",
      label: "Kısmi Ödeme Var",
      nextDueDate,
      nextAmount,
      overdueCount: 0,
      pendingCount: pending.length,
    };
  }

  return {
    tone: "paid",
    label: nextDueDate ? "Ödeme Tamamlandı" : "Borç Bulunmuyor",
    nextDueDate,
    nextAmount,
    overdueCount: 0,
    pendingCount: pending.length,
  };
}
