import type { WellnessReportRow } from "@/types/performance";
import { computeReadinessScore } from "@/lib/wellness/wellnessScore";

/** Son N readiness skorunu mini SVG sparkline olarak uretir. */
export function buildReadinessSparklineSvg(
  reports: WellnessReportRow[],
  maxPoints = 12,
  width = 72,
  height = 20
): string {
  const sorted = [...reports]
    .sort((a, b) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime())
    .slice(-maxPoints);
  if (sorted.length < 2) return "";

  const scores = sorted.map((r) => computeReadinessScore(r));
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const span = max - min || 1;
  const step = width / Math.max(1, scores.length - 1);

  const points = scores
    .map((s, i) => {
      const x = i * step;
      const y = height - 2 - ((s - min) / span) * (height - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><polyline fill="none" stroke="#7c3aed" stroke-width="1.5" points="${points}" /></svg>`;
}
