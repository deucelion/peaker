import type { AcwrPoint, EwmaPoint, TrainingLoadRow } from "@/types/performance";
import { isSyntheticEmptyDay } from "@/lib/performance/loadSeries";
import { analyzeAcwr, type AcwrInsight } from "@/lib/performance/acwrInsights";
import { analyzeEwma, detectEwmaTrend, type EwmaInsight } from "@/lib/performance/ewmaInsights";

export type PerformanceLoad30Summary = {
  avgLoad: number;
  maxLoad: number;
  minLoad: number;
  sessionCount: number;
  riskyDayCount: number;
};

export type PerformanceSmartAnalysis = {
  generalLoadStatus: string;
  riskLevel: string;
  recommendedAction: string;
  recoveryAdvice: string;
  trainingAdvice: string;
  acwr: AcwrInsight;
  ewma: EwmaInsight;
};

export function summarizeLast30DaysLoads(
  loads: TrainingLoadRow[],
  acwrPoints: AcwrPoint[]
): PerformanceLoad30Summary {
  const real = loads.filter((r) => !isSyntheticEmptyDay(r));
  const values = real.map((r) => Number(r.total_load) || 0);
  const sessionCount = real.filter((r) => (Number(r.total_load) || 0) > 0).length;
  const riskyDayCount = acwrPoints.filter((p) => p.ratio > 1.5).length;

  if (values.length === 0) {
    return { avgLoad: 0, maxLoad: 0, minLoad: 0, sessionCount: 0, riskyDayCount: 0 };
  }

  const sum = values.reduce((a, b) => a + b, 0);
  return {
    avgLoad: Math.round(sum / values.length),
    maxLoad: Math.max(...values),
    minLoad: Math.min(...values),
    sessionCount,
    riskyDayCount,
  };
}

const RISK_LABEL_TR: Record<string, string> = {
  low: "Düşük",
  optimal: "Optimal",
  caution: "Dikkat",
  high: "Yüksek",
  nodata: "Veri yok",
};

export function buildPerformanceSmartAnalysis(params: {
  lastAcwr: AcwrPoint | null;
  ewmaSeries: EwmaPoint[];
}): PerformanceSmartAnalysis {
  const last = params.lastAcwr;
  const lastEwma = params.ewmaSeries[params.ewmaSeries.length - 1] ?? null;
  const acwr = analyzeAcwr({
    acuteLoad: last?.akut ?? 0,
    chronicLoad: last?.kronik ?? 0,
    acwr: last?.ratio ?? 0,
  });
  const trend = detectEwmaTrend(params.ewmaSeries);
  const ewma = analyzeEwma({ ewmaRatio: lastEwma?.ewmaRatio ?? 0, trend });

  const dominant =
    acwr.riskLevel === "high" || ewma.riskLevel === "high"
      ? "high"
      : acwr.riskLevel === "caution" || ewma.riskLevel === "caution"
        ? "caution"
        : acwr.riskLevel === "optimal" && ewma.riskLevel === "optimal"
          ? "optimal"
          : acwr.riskLevel;

  const generalLoadStatus =
    dominant === "high"
      ? "Yüklenme baskısı yüksek — sakatlık riski artmış olabilir."
      : dominant === "caution"
        ? "Yük artışı veya toparlanma baskısı izleniyor."
        : dominant === "optimal"
          ? "Yük dengesi genel olarak sağlıklı."
          : dominant === "low"
            ? "Toplam yük düşük — adaptasyon için kademeli artış mümkün."
            : "Karar için yeterli veri yok.";

  const recoveryAdvice =
    dominant === "high" || dominant === "caution"
      ? "Uyku, hidrasyon ve aktif toparlanma günlerini artırın; wellness skorlarını günlük takip edin."
      : "Mevcut recovery rutinini koruyun; nabız ve wellness trendlerini izleyin.";

  const trainingAdvice =
    acwr.recommendation !== ewma.recommendation
      ? `${acwr.recommendation} ${ewma.recommendation}`.trim()
      : acwr.recommendation;

  return {
    generalLoadStatus,
    riskLevel: RISK_LABEL_TR[dominant],
    recommendedAction: trainingAdvice,
    recoveryAdvice,
    trainingAdvice: acwr.coachNote,
    acwr,
    ewma,
  };
}
