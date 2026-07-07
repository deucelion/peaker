const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatAthleteFinanceCurrency(value: number | null | undefined) {
  return currencyFormatter.format(Number(value) || 0);
}

export function formatAthleteFinanceDate(value: string | null | undefined) {
  if (!value) return "-";
  const dt = new Date(`${value}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return "-";
  return dateFormatter.format(dt);
}

export const FINANCE_TIMELINE_PAGE_SIZE = 50;

export type FinanceTab = "tumu" | "hizmet" | "plan";
