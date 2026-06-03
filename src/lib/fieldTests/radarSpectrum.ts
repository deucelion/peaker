export type RadarSpectrumPoint = {
  /** Kısa eksen etiketi (radar üzerinde) */
  subject: string;
  /** 0–100 normalize skor */
  A: number;
  fullMark: number;
  /** Tam test adı (legend) */
  fullName: string;
  unit?: string;
  rawValue: number;
};

function dayKey(iso: string): string {
  return iso?.split("T")[0] ?? "";
}

function truncateLabel(name: string, max = 12): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

function percentileInHistory(value: number, history: number[]): number {
  if (history.length <= 1) return 65;
  const min = Math.min(...history);
  const max = Math.max(...history);
  if (max === min) return 50;
  return ((value - min) / (max - min)) * 100;
}

type ResultLike = {
  value: number | null;
  test_date: string;
  test_definitions?: { name?: string | null; unit?: string | null } | null;
};

/**
 * Yetenek spektrumu: en fazla 8 test, kişisel geçmişe göre 0–100 normalize.
 * Tüm metrikleri radar'a basmak yerine en güncel farklı testler seçilir.
 */
export function buildAthleteRadarSpectrum(
  results: ResultLike[],
  opts?: { maxPoints?: number }
): RadarSpectrumPoint[] {
  const maxPoints = opts?.maxPoints ?? 8;
  const byName = new Map<
    string,
    { history: number[]; latestDate: string; latestValue: number; unit: string }
  >();

  for (const r of results) {
    if (typeof r.value !== "number" || !Number.isFinite(r.value)) continue;
    const name = r.test_definitions?.name?.trim();
    if (!name) continue;
    const date = dayKey(r.test_date);
    const unit = r.test_definitions?.unit?.trim() || "";
    const cur = byName.get(name) || { history: [], latestDate: "", latestValue: 0, unit };
    cur.history.push(r.value);
    if (!cur.latestDate || date >= cur.latestDate) {
      cur.latestDate = date;
      cur.latestValue = r.value;
      cur.unit = unit || cur.unit;
    }
    byName.set(name, cur);
  }

  const ranked = [...byName.entries()]
    .map(([name, e]) => ({
      name,
      unit: e.unit,
      latestDate: e.latestDate,
      latestValue: e.latestValue,
      score: percentileInHistory(e.latestValue, e.history),
    }))
    .sort((a, b) => b.latestDate.localeCompare(a.latestDate));

  return ranked.slice(0, maxPoints).map((row) => ({
    subject: truncateLabel(row.name),
    A: Math.round(row.score),
    fullMark: 100,
    fullName: row.name,
    unit: row.unit || undefined,
    rawValue: row.latestValue,
  }));
}
