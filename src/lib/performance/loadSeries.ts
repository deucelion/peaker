import type { AcwrPoint, EwmaPoint, TrainingLoadRow, WellnessReportRow } from "@/types/performance";
import { isoToZonedDateKey, SCHEDULE_APP_TIME_ZONE } from "@/lib/schedule/scheduleWallTime";
import { computeReadinessScore } from "@/lib/wellness/wellnessScore";

export function getLoadDate(item: TrainingLoadRow): Date {
  const raw = item.measurement_date;
  if (!raw) return new Date(0);
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

export function toShortDateTr(date: Date): string {
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

/**
 * Sentinel marker: fillCalendarDays tarafından üretilen "boş gün" satırlarını
 * gerçek kayıtlardan ayırt etmek için. Risk istatistikleri (avg RPE, monotony,
 * strain) gibi gerçek girilmiş veriye dayanması gereken hesaplar bu satırları
 * filtreleyerek dışarıda bırakır.
 */
export const SYNTHETIC_EMPTY_DAY_PROFILE_ID = "__empty_day__";

export function isSyntheticEmptyDay(row: TrainingLoadRow): boolean {
  return row.profile_id === SYNTHETIC_EMPTY_DAY_PROFILE_ID;
}

/**
 * Verilen `[fromKey, toKey]` aralığındaki HER takvim günü için bir nokta üretir.
 *
 * - Mevcut load satırları (org TZ takvim gününe göre) korunur.
 * - Aynı güne birden fazla satır varsa `aggregateTrainingLoadsByCalendarDay`
 *   sonrası verilmesi beklenir; o yüzden burada "ilk eşleşen" yeterli.
 * - Ölçüm olmayan günler için `total_load = 0`, `rpe_score = null` synthetic satır.
 * - Sıralı (artan) bir dizi döner; ACWR/EWMA penceresi gerçek 7g/28g takvim günü
 *   olur, "son 7 kayıt" pseudo-pencere değil.
 *
 * Backward-compat: yeni helper. `processACWRData` / `processEWMAData` davranışı
 * çağrıldıkları girişe göre değişmez; çağrı yerleri (Performans page,
 * AthletePerformanceInsightsPanel) bu helper'ı opsiyonel olarak kullanır.
 */
export function fillCalendarDays(
  loads: TrainingLoadRow[],
  fromKey: string,
  toKey: string,
  tz: string = SCHEDULE_APP_TIME_ZONE
): TrainingLoadRow[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromKey) || !/^\d{4}-\d{2}-\d{2}$/.test(toKey)) {
    return [...loads].sort((a, b) => getLoadDate(a).getTime() - getLoadDate(b).getTime());
  }
  if (fromKey > toKey) return [];

  const byKey = new Map<string, TrainingLoadRow>();
  for (const row of loads) {
    const key = loadRowIstanbulDateKey(row, tz);
    if (!key) continue;
    if (key < fromKey || key > toKey) continue;
    if (!byKey.has(key)) byKey.set(key, row);
  }

  const out: TrainingLoadRow[] = [];
  for (const dayKey of enumerateCalendarDayKeys(fromKey, toKey)) {
    const found = byKey.get(dayKey);
    if (found) {
      out.push(found);
    } else {
      out.push({
        profile_id: SYNTHETIC_EMPTY_DAY_PROFILE_ID,
        measurement_date: `${dayKey}T12:00:00.000Z`,
        total_load: 0,
        rpe_score: null,
      });
    }
  }
  return out;
}

function enumerateCalendarDayKeys(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  if ([fy, fm, fd, ty, tm, td].some((n) => !Number.isFinite(n))) return out;
  // UTC tabanlı yürütüş; sadece takvim günü etiketi üretiriz, TZ'a duyarsız:
  // her iki uç UTC öğlende temsil edilir, gün arası eşit aralık.
  const cur = new Date(Date.UTC(fy, fm - 1, fd, 12, 0, 0));
  const end = new Date(Date.UTC(ty, tm - 1, td, 12, 0, 0));
  while (cur.getTime() <= end.getTime()) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cur.getUTCDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/**
 * Takım kapsamında aynı takvim gününe ait birden fazla sporcu kaydını tek günlük noktaya indirir.
 * Günlük ortalama toplam yük (AU) ve o gün RPE girenlerin ortalama RPE değeri — ACWR/EWMA tek zaman ekseninde tutarlı kalır.
 */
export function aggregateTrainingLoadsByCalendarDay(loads: TrainingLoadRow[]): TrainingLoadRow[] {
  if (loads.length === 0) return [];
  const byDay = new Map<string, { sumLoad: number; rpeSum: number; rpeN: number; rowN: number }>();
  for (const row of loads) {
    const raw = row.measurement_date;
    if (!raw) continue;
    const key = raw.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    const cur = byDay.get(key) ?? { sumLoad: 0, rpeSum: 0, rpeN: 0, rowN: 0 };
    cur.sumLoad += Number(row.total_load) || 0;
    cur.rowN += 1;
    const r = Number(row.rpe_score);
    if (Number.isFinite(r) && r > 0) {
      cur.rpeSum += r;
      cur.rpeN += 1;
    }
    byDay.set(key, cur);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, agg]) => ({
      profile_id: "__team_day__",
      measurement_date: `${day}T12:00:00.000Z`,
      total_load: agg.rowN > 0 ? Math.round((agg.sumLoad / agg.rowN) * 10) / 10 : 0,
      rpe_score: agg.rpeN > 0 ? Math.round((agg.rpeSum / agg.rpeN) * 10) / 10 : null,
    }));
}

/**
 * ACWR serisi: her gün için akut = son **7** günün ortalama günlük yükü, kronik = son **28** günün ortalama günlük yükü (dahil günler).
 * Oran = akut / kronik; kronik 0 ise 0. Risk bantları: >1.5 yüksek, 0.8–1.3 sweet spot (computeRiskStats ile uyumlu).
 */
export function processACWRData(loads: TrainingLoadRow[]): AcwrPoint[] {
  return loads.map((day, index) => {
    const startAkut = Math.max(0, index - 6);
    const startKronik = Math.max(0, index - 27);

    const akutSlice = loads.slice(startAkut, index + 1);
    const kronikSlice = loads.slice(startKronik, index + 1);

    const akutAvg = akutSlice.reduce((sum, item) => sum + (item.total_load || 0), 0) / (akutSlice.length || 1);
    const kronikAvg = kronikSlice.reduce((sum, item) => sum + (item.total_load || 0), 0) / (kronikSlice.length || 1);

    const ratio = kronikAvg > 0 ? akutAvg / kronikAvg : 0;
    const safeRatio = Number.isFinite(ratio) ? ratio : 0;
    const d = getLoadDate(day);

    return {
      date: toShortDateTr(d),
      ts: d.getTime(),
      akut: Math.round(akutAvg),
      kronik: Math.round(kronikAvg),
      ratio: parseFloat(safeRatio.toFixed(2)),
    };
  });
}

export function processEWMAData(loads: TrainingLoadRow[]): EwmaPoint[] {
  const lambdaAcute = 2 / (7 + 1);
  const lambdaChronic = 2 / (28 + 1);
  let acuteEwma = 0;
  let chronicEwma = 0;

  return loads.map((day, idx) => {
    const load = Number(day.total_load) || 0;
    if (idx === 0) {
      acuteEwma = load;
      chronicEwma = load;
    } else {
      acuteEwma = lambdaAcute * load + (1 - lambdaAcute) * acuteEwma;
      chronicEwma = lambdaChronic * load + (1 - lambdaChronic) * chronicEwma;
    }

    const ratio = chronicEwma > 0 ? acuteEwma / chronicEwma : 0;
    const safeRatio = Number.isFinite(ratio) ? ratio : 0;
    const d = getLoadDate(day);
    return {
      date: toShortDateTr(d),
      ts: d.getTime(),
      acuteEwma: Math.round(acuteEwma),
      chronicEwma: Math.round(chronicEwma),
      ewmaRatio: Number(safeRatio.toFixed(2)),
    };
  });
}

/**
 * measurement_date anının takvim günü (YYYY-MM-DD).
 * @param tz IANA tz; verilmezse global varsayılan.
 */
export function loadRowIstanbulDateKey(row: TrainingLoadRow, tz: string = SCHEDULE_APP_TIME_ZONE): string {
  const raw = row.measurement_date;
  if (!raw) return "";
  return isoToZonedDateKey(new Date(raw).toISOString(), tz);
}

export function filterTrainingLoadsByIstanbulInclusiveRange(
  loads: TrainingLoadRow[],
  fromKey: string,
  toKey: string,
  tz: string = SCHEDULE_APP_TIME_ZONE
): TrainingLoadRow[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromKey) || !/^\d{4}-\d{2}-\d{2}$/.test(toKey)) return [];
  return loads.filter((row) => {
    const k = loadRowIstanbulDateKey(row, tz);
    return k >= fromKey && k <= toKey;
  });
}

export function filterAcwrPointsByIstanbulInclusiveRange(
  points: AcwrPoint[],
  fromKey: string,
  toKey: string,
  tz: string = SCHEDULE_APP_TIME_ZONE
): AcwrPoint[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromKey) || !/^\d{4}-\d{2}-\d{2}$/.test(toKey)) return [];
  return points.filter((p) => {
    const k = isoToZonedDateKey(new Date(p.ts).toISOString(), tz);
    return k >= fromKey && k <= toKey;
  });
}

export function filterEwmaPointsByIstanbulInclusiveRange(
  points: EwmaPoint[],
  fromKey: string,
  toKey: string,
  tz: string = SCHEDULE_APP_TIME_ZONE
): EwmaPoint[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromKey) || !/^\d{4}-\d{2}-\d{2}$/.test(toKey)) return [];
  return points.filter((p) => {
    const k = isoToZonedDateKey(new Date(p.ts).toISOString(), tz);
    return k >= fromKey && k <= toKey;
  });
}

export { computeReadinessScore as getReadinessScore } from "@/lib/wellness/wellnessScore";

export type RiskStatsSummary = {
  critical: number;
  sweetSpot: number;
  /** Geçerli RPE örneği yoksa null (0 ile veri yok karışmasın) */
  avgRpe: number | null;
  ewmaRisk: number;
  /** Standart sapma 0 veya yük yoksa null */
  monotony: number | null;
  strain: number | null;
  readiness: number;
  /** Readiness ortalamasına giren wellness raporu sayısı (seçili dönemde, en fazla 7) */
  readinessReportCount: number;
  highRiskStreak: number;
};

export function emptyRiskStats(): RiskStatsSummary {
  return {
    critical: 0,
    sweetSpot: 0,
    avgRpe: null,
    ewmaRisk: 0,
    monotony: null,
    strain: null,
    readiness: 0,
    readinessReportCount: 0,
    highRiskStreak: 0,
  };
}

export function computeRiskStats(
  processed: AcwrPoint[],
  ewmaProcessed: EwmaPoint[],
  rawLoads: TrainingLoadRow[],
  reports: WellnessReportRow[]
): RiskStatsSummary {
  const critical = processed.filter((d) => d.ratio > 1.5).length;
  const sweetSpot = processed.filter((d) => d.ratio >= 0.8 && d.ratio <= 1.3).length;
  const ewmaRisk = ewmaProcessed.filter((d) => d.ewmaRatio > 1.5).length;

  const rpeVals = rawLoads
    .map((item) => Number(item.rpe_score))
    .filter((n) => Number.isFinite(n) && n > 0);
  const avgRpe =
    rpeVals.length > 0 ? parseFloat((rpeVals.reduce((a, b) => a + b, 0) / rpeVals.length).toFixed(1)) : null;

  const sortedLoads = [...rawLoads].sort((a, b) => getLoadDate(a).getTime() - getLoadDate(b).getTime());
  const latestWeekLoads = sortedLoads.slice(-7).map((item) => Number(item.total_load) || 0);
  const weekMean =
    latestWeekLoads.length > 0 ? latestWeekLoads.reduce((sum, v) => sum + v, 0) / latestWeekLoads.length : 0;
  const variance =
    latestWeekLoads.length > 0
      ? latestWeekLoads.reduce((sum, v) => sum + Math.pow(v - weekMean, 2), 0) / latestWeekLoads.length
      : 0;
  const sd = Math.sqrt(variance);
  const monotony = sd > 0 && Number.isFinite(weekMean) ? Number((weekMean / sd).toFixed(2)) : null;
  const weeklyLoad = latestWeekLoads.reduce((sum, v) => sum + v, 0);
  const strain =
    monotony != null && Number.isFinite(weeklyLoad) && Number.isFinite(monotony)
      ? Math.round(weeklyLoad * monotony)
      : null;

  const recentReadiness = reports.slice(0, 7).map(computeReadinessScore);
  const readinessReportCount = recentReadiness.length;
  const readiness =
    recentReadiness.length > 0
      ? Math.round(recentReadiness.reduce((sum, s) => sum + s, 0) / recentReadiness.length)
      : 0;

  let streak = 0;
  const nStreak = Math.min(processed.length, ewmaProcessed.length);
  for (let i = nStreak - 1; i >= 0; i -= 1) {
    const acwrHigh = processed[i]?.ratio > 1.5;
    const ewHigh = ewmaProcessed[i]?.ewmaRatio > 1.5;
    if (acwrHigh || ewHigh) streak += 1;
    else break;
  }

  return {
    critical,
    sweetSpot,
    avgRpe,
    ewmaRisk,
    monotony,
    strain,
    readiness,
    readinessReportCount,
    highRiskStreak: streak,
  };
}
