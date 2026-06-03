export type EwmaTrend =
  | "rising_acute_stable_chronic"
  | "rising_both"
  | "recovery"
  | "deload"
  | "stable"
  | "nodata";

export type EwmaRiskLevel = "low" | "optimal" | "caution" | "high" | "nodata";

export type EwmaInsight = {
  trend: EwmaTrend;
  riskLevel: EwmaRiskLevel;
  summary: string;
  recommendation: string;
  coachNote: string;
};

const TREND_WINDOW = 5;
const SLOPE_EPS = 0.015;

function normalizedSlope(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (!Number.isFinite(mean) || mean <= 0) return 0;
  const steps = Math.max(1, values.length - 1);
  return (values[values.length - 1]! - values[0]!) / steps / mean;
}

export function detectEwmaTrend(points: { acuteEwma: number; chronicEwma: number }[]): EwmaTrend {
  if (points.length < 3) return "nodata";
  const tail = points.slice(-TREND_WINDOW);
  const acuteSlope = normalizedSlope(tail.map((p) => p.acuteEwma));
  const chronicSlope = normalizedSlope(tail.map((p) => p.chronicEwma));

  if (acuteSlope > SLOPE_EPS && chronicSlope <= SLOPE_EPS) return "rising_acute_stable_chronic";
  if (acuteSlope > SLOPE_EPS && chronicSlope > SLOPE_EPS) return "rising_both";
  if (acuteSlope < -SLOPE_EPS && chronicSlope < -SLOPE_EPS) return "deload";
  if (acuteSlope < -SLOPE_EPS && chronicSlope <= SLOPE_EPS) return "recovery";
  return "stable";
}

export function analyzeEwma(input: {
  ewmaRatio: number;
  trend: EwmaTrend;
}): EwmaInsight {
  const ratio = Number(input.ewmaRatio);
  const trend = input.trend;

  if (!Number.isFinite(ratio) || ratio <= 0 || trend === "nodata") {
    return {
      trend: "nodata",
      riskLevel: "nodata",
      summary: "EWMA trend verisi yetersiz",
      recommendation: "Düzenli yük kaydı ile trend oluşur.",
      coachNote: "Son günlerde yeterli ölçüm yok.",
    };
  }

  if (trend === "rising_acute_stable_chronic") {
    return {
      trend,
      riskLevel: ratio > 1.5 ? "high" : ratio > 1.3 ? "caution" : "caution",
      summary: "Artan akut yük, stabil kronik — aşırı yüklenme riski",
      recommendation: "Hacim/yoğunluk gözden geçirilmeli; ani sıçrama önlenmeli.",
      coachNote: "Akut EWMA yükselirken kronik sabit; spike öncesi dönem olabilir.",
    };
  }

  if (trend === "rising_both") {
    return {
      trend,
      riskLevel: ratio > 1.5 ? "caution" : "optimal",
      summary: "Artan akut + artan kronik — kontrollü gelişim",
      recommendation: "Progresyon sürdürülebilir; yük artışı kademeli kalmalı.",
      coachNote: "Her iki EWMA bileşeni birlikte yükseliyor; planlı adaptasyon dönemi.",
    };
  }

  if (trend === "deload") {
    return {
      trend,
      riskLevel: "low",
      summary: "Deload dönemi — akut ve kronik yük düşüyor",
      recommendation: "Planlı dinlenme devam edebilir; dönüş öncesi wellness takibi.",
      coachNote: "Her iki EWMA düşüşte; kas-iskelet sistemi toparlanıyor.",
    };
  }

  if (trend === "recovery") {
    return {
      trend,
      riskLevel: "low",
      summary: "Azalan akut, yüksek kronik — toparlanma",
      recommendation: "Hafif günler ve uyku/wellness öncelikli.",
      coachNote: "Akut yük düşüyor; kronik kapasite korunuyor.",
    };
  }

  const riskLevel: EwmaRiskLevel =
    ratio > 1.5 ? "high" : ratio > 1.3 ? "caution" : ratio >= 0.8 && ratio <= 1.3 ? "optimal" : "low";

  return {
    trend: "stable",
    riskLevel,
    summary: "EWMA trend stabil",
    recommendation:
      riskLevel === "optimal"
        ? "Mevcut yük profili sürdürülebilir."
        : riskLevel === "high"
          ? "EWMA oranı risk eşiğinde — yükü düşürün."
          : "Trend izlemeye devam edin.",
    coachNote: "Belirgin akut/kronik ayrışması yok; rutin takip yeterli.",
  };
}
