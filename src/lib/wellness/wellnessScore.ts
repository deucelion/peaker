import type { WellnessReportRow } from "@/types/performance";

/** 1–5 Likert skalası. */
export const WELLNESS_SCALE_MAX = 5;

export type WellnessMetricKey =
  | "fatigue"
  | "sleep_quality"
  | "muscle_soreness"
  | "stress_level"
  | "energy_level"
  | "motivation";

/** Yüksek ham skor = iyi (uyku, enerji, motivasyon). */
export type WellnessPolarity = "positive" | "negative";

export const WELLNESS_METRIC_POLARITY: Record<WellnessMetricKey, WellnessPolarity> = {
  fatigue: "negative",
  sleep_quality: "positive",
  muscle_soreness: "negative",
  stress_level: "negative",
  energy_level: "positive",
  motivation: "positive",
};

const LABELS_TR: Record<WellnessMetricKey, Record<1 | 2 | 3 | 4 | 5, string>> = {
  fatigue: { 1: "Dinç", 2: "Az yorgun", 3: "Orta", 4: "Yorgun", 5: "Tükenmiş" },
  sleep_quality: { 1: "Çok kötü", 2: "Kötü", 3: "Orta", 4: "İyi", 5: "Mükemmel" },
  muscle_soreness: { 1: "Yok", 2: "Hafif", 3: "Orta", 4: "Belirgin", 5: "Çok fazla" },
  stress_level: { 1: "Rahat", 2: "Hafif", 3: "Orta", 4: "Yüksek", 5: "Çok yüksek" },
  energy_level: { 1: "Çok düşük", 2: "Düşük", 3: "Orta", 4: "İyi", 5: "Çok yüksek" },
  motivation: { 1: "Çok düşük", 2: "Düşük", 3: "Orta", 4: "İyi", 5: "Çok yüksek" },
};

export function clampWellnessScale(value: number | null | undefined): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 1 || n > WELLNESS_SCALE_MAX) return null;
  return Math.round(n);
}

export function getWellnessPolarity(key: WellnessMetricKey): WellnessPolarity {
  return WELLNESS_METRIC_POLARITY[key];
}

/**
 * Ham skoru readiness bileşenine çevirir (0–100; 100 = en iyi durum).
 * Pozitif metrikler: 1→0, 5→100
 * Negatif metrikler: 1→100, 5→0
 */
export function wellnessComponentPercent(key: WellnessMetricKey, value: number | null | undefined): number {
  const v = clampWellnessScale(value);
  if (v == null) return 0;
  if (WELLNESS_METRIC_POLARITY[key] === "positive") {
    return Math.round(((v - 1) / 4) * 100);
  }
  return Math.round(((5 - v) / 4) * 100);
}

export function getWellnessMetricLabel(key: WellnessMetricKey, value: number | null | undefined): string {
  const v = clampWellnessScale(value);
  if (v == null) return "—";
  return LABELS_TR[key][v as 1 | 2 | 3 | 4 | 5];
}

export type WellnessScoreTone = "good" | "mid" | "bad" | "none";

/** UI renk tonu — polariteye göre yorumlanır. */
export function getWellnessScoreTone(key: WellnessMetricKey, value: number | null | undefined): WellnessScoreTone {
  const v = clampWellnessScale(value);
  if (v == null) return "none";
  const pol = WELLNESS_METRIC_POLARITY[key];
  const isGood = pol === "positive" ? v >= 4 : v <= 2;
  const isBad = pol === "positive" ? v <= 2 : v >= 4;
  if (isGood) return "good";
  if (isBad) return "bad";
  return "mid";
}

export function wellnessToneToTextClass(tone: WellnessScoreTone): string {
  if (tone === "good") return "text-green-400";
  if (tone === "mid") return "text-yellow-400";
  if (tone === "bad") return "text-red-500";
  return "text-gray-600";
}

/**
 * Readiness (0–100): tüm alanlar aynı yöne normalize edilir.
 * 100 = mükemmel, 0 = çok kötü.
 */
export function computeReadinessScore(report: WellnessReportRow): number {
  const sleep = wellnessComponentPercent("sleep_quality", report.sleep_quality);
  const energy = wellnessComponentPercent("energy_level", report.energy_level);
  const fatigue = wellnessComponentPercent("fatigue", report.fatigue);
  const soreness = wellnessComponentPercent("muscle_soreness", report.muscle_soreness);
  const stress = wellnessComponentPercent("stress_level", report.stress_level);
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

/** Yorgunluk/stres/ağrı yüksek ham skor = kötü durum. */
export function isWellnessReportCritical(report: WellnessReportRow): boolean {
  const fatigue = clampWellnessScale(report.fatigue);
  const stress = clampWellnessScale(report.stress_level);
  const soreness = clampWellnessScale(report.muscle_soreness);
  return (fatigue != null && fatigue >= 4) || (stress != null && stress >= 4) || (soreness != null && soreness >= 4);
}

export function fatigueStatusLabel(fatigue: number | null | undefined): { label: string; tone: WellnessScoreTone } {
  return getWellnessScoreTone("fatigue", fatigue) === "none"
    ? { label: "VERİ YOK", tone: "none" }
    : getWellnessScoreTone("fatigue", fatigue) === "bad"
      ? { label: "YÜKSEK YORGUNLUK", tone: "bad" }
      : getWellnessScoreTone("fatigue", fatigue) === "mid"
        ? { label: "ORTA", tone: "mid" }
        : { label: "İYİ DURUM", tone: "good" };
}
