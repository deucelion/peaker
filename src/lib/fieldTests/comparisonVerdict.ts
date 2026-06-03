export type MetricImprovementDirection = "higher_better" | "lower_better" | "unknown";

export type ComparisonVerdict = "improved" | "regressed" | "unchanged" | "unknown";

const STABLE_THRESHOLD_PCT = 2;

export function formatChangePercent(oldVal: number, newVal: number): string | null {
  if (!Number.isFinite(oldVal) || !Number.isFinite(newVal)) return null;
  if (oldVal === 0 && newVal === 0) return "0%";
  const base = oldVal === 0 ? Math.abs(newVal) : Math.abs(oldVal);
  if (base === 0) return null;
  const pct = ((newVal - oldVal) / base) * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export function classifyFieldTestComparison(
  direction: MetricImprovementDirection,
  oldVal: number,
  newVal: number
): ComparisonVerdict {
  if (!Number.isFinite(oldVal) || !Number.isFinite(newVal)) return "unknown";
  if (oldVal === newVal) return "unchanged";

  const base = oldVal === 0 ? Math.abs(newVal) : Math.abs(oldVal);
  const pct = base === 0 ? 0 : ((newVal - oldVal) / base) * 100;
  if (Math.abs(pct) <= STABLE_THRESHOLD_PCT) return "unchanged";

  if (direction === "higher_better") return newVal > oldVal ? "improved" : "regressed";
  if (direction === "lower_better") return newVal < oldVal ? "improved" : "regressed";
  return "unknown";
}

export function comparisonCommentTr(verdict: ComparisonVerdict): string {
  if (verdict === "improved") return "Gelişim";
  if (verdict === "regressed") return "Gerileme";
  if (verdict === "unchanged") return "Değişim yok";
  return "Yorum yok";
}
