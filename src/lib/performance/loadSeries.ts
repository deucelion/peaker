import type { AcwrPoint, EwmaPoint, TrainingLoadRow, WellnessReportRow } from "@/types/performance";

export function getLoadDate(item: TrainingLoadRow): Date {
  const raw = item.measurement_date;
  if (!raw) return new Date(0);
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

export function toShortDateTr(date: Date): string {
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

export function processACWRData(loads: TrainingLoadRow[]): AcwrPoint[] {
  return loads.map((day, index) => {
    const startAkut = Math.max(0, index - 7);
    const startKronik = Math.max(0, index - 28);

    const akutSlice = loads.slice(startAkut, index + 1);
    const kronikSlice = loads.slice(startKronik, index + 1);

    const akutAvg = akutSlice.reduce((sum, item) => sum + (item.total_load || 0), 0) / (akutSlice.length || 1);
    const kronikAvg = kronikSlice.reduce((sum, item) => sum + (item.total_load || 0), 0) / (kronikSlice.length || 1);

    const ratio = kronikAvg > 0 ? akutAvg / kronikAvg : 0;
    const d = getLoadDate(day);

    return {
      date: toShortDateTr(d),
      ts: d.getTime(),
      akut: Math.round(akutAvg),
      kronik: Math.round(kronikAvg),
      ratio: parseFloat(ratio.toFixed(2)),
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
    return {
      date: toShortDateTr(getLoadDate(day)),
      acuteEwma: Math.round(acuteEwma),
      chronicEwma: Math.round(chronicEwma),
      ewmaRatio: Number(ratio.toFixed(2)),
    };
  });
}

export function getReadinessScore(report: WellnessReportRow): number {
  const sleep = (Number(report.sleep_quality) || 0) * 20;
  const energy = (Number(report.energy_level) || 0) * 20;
  const stress = 100 - (Number(report.stress_level) || 0) * 20;
  const fatigue = 100 - (Number(report.fatigue) || 0) * 20;
  const soreness = 100 - (Number(report.muscle_soreness) || 0) * 20;
  const heartRate = Number(report.resting_heart_rate) || 0;
  const heartComponent = Math.max(0, Math.min(100, Math.round(((95 - heartRate) / 45) * 100)));

  const weighted =
    sleep * 0.2 +
    energy * 0.2 +
    stress * 0.2 +
    fatigue * 0.15 +
    soreness * 0.15 +
    heartComponent * 0.1;

  return Math.round(weighted);
}

export type RiskStatsSummary = {
  critical: number;
  sweetSpot: number;
  avgRpe: number;
  ewmaRisk: number;
  monotony: number;
  strain: number;
  readiness: number;
  highRiskStreak: number;
};

export function emptyRiskStats(): RiskStatsSummary {
  return {
    critical: 0,
    sweetSpot: 0,
    avgRpe: 0,
    ewmaRisk: 0,
    monotony: 0,
    strain: 0,
    readiness: 0,
    highRiskStreak: 0,
  };
}

export function computeRiskStats(
  processed: AcwrPoint[],
  ewmaProcessed: EwmaPoint[],
  rawLoads: TrainingLoadRow[],
  reports: WellnessReportRow[]
): RiskStatsSummary {
  const latestRatios = processed.slice(-10);
  const latestEwmaRatios = ewmaProcessed.slice(-10);
  const critical = latestRatios.filter((d) => d.ratio > 1.5).length;
  const sweetSpot = latestRatios.filter((d) => d.ratio >= 0.8 && d.ratio <= 1.3).length;
  const ewmaRisk = latestEwmaRatios.filter((d) => d.ewmaRatio > 1.5).length;
  const avgRpe = rawLoads.reduce((sum, item) => sum + (item.rpe_score || 0), 0) / (rawLoads.length || 1);

  const latestWeekLoads = rawLoads.slice(-7).map((item) => Number(item.total_load) || 0);
  const weekMean =
    latestWeekLoads.length > 0 ? latestWeekLoads.reduce((sum, v) => sum + v, 0) / latestWeekLoads.length : 0;
  const variance =
    latestWeekLoads.length > 0
      ? latestWeekLoads.reduce((sum, v) => sum + Math.pow(v - weekMean, 2), 0) / latestWeekLoads.length
      : 0;
  const sd = Math.sqrt(variance);
  const monotony = sd > 0 ? Number((weekMean / sd).toFixed(2)) : 0;
  const weeklyLoad = latestWeekLoads.reduce((sum, v) => sum + v, 0);
  const strain = Math.round(weeklyLoad * monotony);

  const recentReadiness = reports.slice(0, 7).map(getReadinessScore);
  const readiness =
    recentReadiness.length > 0
      ? Math.round(recentReadiness.reduce((sum, s) => sum + s, 0) / recentReadiness.length)
      : 0;

  let streak = 0;
  for (let i = processed.length - 1; i >= 0; i -= 1) {
    const acwrHigh = processed[i]?.ratio > 1.5;
    const ewHigh = ewmaProcessed[i]?.ewmaRatio > 1.5;
    if (acwrHigh || ewHigh) streak += 1;
    else break;
  }

  return {
    critical,
    sweetSpot,
    avgRpe: parseFloat(avgRpe.toFixed(1)),
    ewmaRisk,
    monotony,
    strain,
    readiness,
    highRiskStreak: streak,
  };
}
