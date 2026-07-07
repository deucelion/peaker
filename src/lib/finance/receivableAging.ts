import type { ReceivablePackageRow } from "@/lib/actions/receivableDashboardActions";

export type AgingBucketKey = "0-30" | "31-60" | "61-90" | "90+";

export type AgingBucketSummary = {
  key: AgingBucketKey;
  label: string;
  count: number;
  amount: number;
};

export const AGING_BUCKET_LABELS: Record<AgingBucketKey, string> = {
  "0-30": "0–30 gün",
  "31-60": "31–60 gün",
  "61-90": "61–90 gün",
  "90+": "90+ gün",
};

function bucketForDays(days: number): AgingBucketKey {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

/** Gecikmiş paket satırlarından yaşlandırma kovaları hesaplar. */
export function computeReceivableAgingBuckets(rows: ReceivablePackageRow[]): AgingBucketSummary[] {
  const totals: Record<AgingBucketKey, { count: number; amount: number }> = {
    "0-30": { count: 0, amount: 0 },
    "31-60": { count: 0, amount: 0 },
    "61-90": { count: 0, amount: 0 },
    "90+": { count: 0, amount: 0 },
  };

  for (const row of rows) {
    if (row.receivableStatus !== "overdue") continue;
    const days = row.daysOverdue;
    if (days == null || !Number.isFinite(days) || days < 0) continue;
    const key = bucketForDays(days);
    totals[key].count += 1;
    totals[key].amount += row.remainingBalance;
  }

  return (Object.keys(totals) as AgingBucketKey[]).map((key) => ({
    key,
    label: AGING_BUCKET_LABELS[key],
    count: totals[key].count,
    amount: totals[key].amount,
  }));
}
