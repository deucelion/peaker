import type { PaymentRow } from "@/types/domain";
import type { FinanceStatusSummary } from "@/lib/types/finance";
import { normalizeMoney } from "@/lib/privateLessons/packageMath";

const DAY_MS = 24 * 60 * 60 * 1000;

function dateOnlyMs(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).getTime();
}

function todayDateOnlyMs() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

/** Özel ders paketlerinde kalan tahsilat bakiyesi (payments bekliyor hariç). */
export function sumPackageOpenBalance(
  packages: ReadonlyArray<{
    payment_status?: string | null;
    total_price?: unknown;
    amount_paid?: unknown;
  }>
): number {
  let sum = 0;
  for (const pkg of packages) {
    const status = String(pkg.payment_status || "").toLowerCase();
    if (status === "paid") continue;
    const total = normalizeMoney(pkg.total_price as number | string | null | undefined);
    const paid = normalizeMoney(pkg.amount_paid as number | string | null | undefined);
    if (total <= 0) continue;
    sum += Math.max(0, normalizeMoney(total - paid));
  }
  return normalizeMoney(sum);
}

export function computeFinanceStatusSummary(input: {
  aidatPayments: PaymentRow[];
  plannedNextDueDate?: string | null;
  plannedNextAmount?: number | null;
  hasPartialPackagePayment?: boolean;
  /** Paket total_price − amount_paid (ödenmemiş/kısmi). */
  packageOpenBalance?: number;
}): FinanceStatusSummary {
  const packageOpen = normalizeMoney(input.packageOpenBalance ?? 0);
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
      label: "Gecikmiş Ödeme",
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
        label: "Gecikmiş Ödeme",
        nextDueDate,
        nextAmount,
        overdueCount: 1,
        pendingCount: pending.length,
      };
    }
  }

  if (pending.length > 0 || input.hasPartialPackagePayment) {
    const partial: FinanceStatusSummary = {
      tone: "paid",
      label: "Kısmi Ödeme",
      nextDueDate,
      nextAmount,
      overdueCount: 0,
      pendingCount: pending.length,
    };
    return applyPackageOpenBalanceToSummary(partial, packageOpen);
  }

  const settled: FinanceStatusSummary = {
    tone: "paid",
    label: nextDueDate ? "Ödeme Tamamlandı" : "Borç Bulunmuyor",
    nextDueDate,
    nextAmount,
    overdueCount: 0,
    pendingCount: pending.length,
  };
  return applyPackageOpenBalanceToSummary(settled, packageOpen);
}

function applyPackageOpenBalanceToSummary(
  summary: FinanceStatusSummary,
  packageOpen: number
): FinanceStatusSummary {
  if (packageOpen <= 0.001) return summary;
  if (summary.label === "Gecikmiş Ödeme" || summary.tone === "overdue") return summary;
  if (summary.label === "Ödeme Bekleniyor" && summary.tone === "approaching") return summary;
  if (summary.label === "Kısmi Ödeme" && summary.pendingCount > 0) return summary;
  return {
    ...summary,
    tone: "paid",
    label: "Açık Bakiye Var",
    pendingCount: summary.pendingCount,
  };
}
