import { describe, expect, it } from "vitest";
import type { WellnessReportRow } from "@/types/performance";
import {
  computeReadinessScore,
  fatigueStatusLabel,
  getWellnessMetricLabel,
  getWellnessScoreTone,
  isWellnessReportCritical,
  wellnessComponentPercent,
} from "./wellnessScore";

function report(partial: Partial<WellnessReportRow>): WellnessReportRow {
  return {
    id: "w1",
    profile_id: "p1",
    report_date: "2026-06-01",
    ...partial,
  } as WellnessReportRow;
}

describe("wellnessScore (FAZ 28 audit)", () => {
  it("negatif metrik: yorgunluk 5 = tukenmis, 1 = dinc", () => {
    expect(getWellnessMetricLabel("fatigue", 5)).toBe("Tükenmiş");
    expect(getWellnessMetricLabel("fatigue", 1)).toBe("Dinç");
    expect(wellnessComponentPercent("fatigue", 5)).toBe(0);
    expect(wellnessComponentPercent("fatigue", 1)).toBe(100);
  });

  it("pozitif metrik: uyku 5 = mukemmel", () => {
    expect(getWellnessMetricLabel("sleep_quality", 5)).toBe("Mükemmel");
    expect(wellnessComponentPercent("sleep_quality", 5)).toBe(100);
    expect(wellnessComponentPercent("sleep_quality", 1)).toBe(0);
  });

  it("tone: yorgunluk 5 kotu, uyku 5 iyi", () => {
    expect(getWellnessScoreTone("fatigue", 5)).toBe("bad");
    expect(getWellnessScoreTone("fatigue", 1)).toBe("good");
    expect(getWellnessScoreTone("sleep_quality", 5)).toBe("good");
    expect(getWellnessScoreTone("sleep_quality", 1)).toBe("bad");
  });

  it("readiness: dusuk yorgunluk + iyi uyku > yuksek yorgunluk", () => {
    const rested = computeReadinessScore(
      report({
        sleep_quality: 5,
        energy_level: 4,
        fatigue: 1,
        muscle_soreness: 1,
        stress_level: 1,
        resting_heart_rate: 60,
      })
    );
    const exhausted = computeReadinessScore(
      report({
        sleep_quality: 2,
        energy_level: 2,
        fatigue: 5,
        muscle_soreness: 5,
        stress_level: 5,
        resting_heart_rate: 85,
      })
    );
    expect(rested).toBeGreaterThan(exhausted);
  });

  it("critical: yuksek yorgunluk/stres/agri", () => {
    expect(isWellnessReportCritical(report({ fatigue: 5 }))).toBe(true);
    expect(isWellnessReportCritical(report({ fatigue: 1, stress_level: 1, muscle_soreness: 1 }))).toBe(false);
  });

  it("fatigueStatusLabel: skor 5 yuksek yorgunluk", () => {
    expect(fatigueStatusLabel(5).label).toBe("YÜKSEK YORGUNLUK");
    expect(fatigueStatusLabel(1).label).toBe("İYİ DURUM");
  });
});
