import { istanbulMonthToPayoutDateInclusiveBounds } from "@/lib/accountingFinance/istanbulQueryRange";

/** Muhasebe export stream için YYYY-MM-DD aralığı (özel tarih veya ay görünümü). */
export function resolvePaymentsExportDateRange(input: {
  month: string;
  dateFrom?: string;
  dateTo?: string;
}): { dateFrom: string; dateTo: string } | null {
  const from = (input.dateFrom || "").trim();
  const to = (input.dateTo || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    if (from > to) return null;
    return { dateFrom: from, dateTo: to };
  }
  const bounds = istanbulMonthToPayoutDateInclusiveBounds(input.month);
  if (!bounds) return null;
  return { dateFrom: bounds.fromKey, dateTo: bounds.toKeyInclusive };
}
