import { describe, expect, it } from "vitest";
import { analyzeEwma, detectEwmaTrend } from "./ewmaInsights";

describe("detectEwmaTrend", () => {
  it("artan akut + stabil kronik", () => {
    const points = [
      { acuteEwma: 300, chronicEwma: 400 },
      { acuteEwma: 320, chronicEwma: 401 },
      { acuteEwma: 350, chronicEwma: 402 },
      { acuteEwma: 390, chronicEwma: 403 },
      { acuteEwma: 430, chronicEwma: 404 },
    ];
    expect(detectEwmaTrend(points)).toBe("rising_acute_stable_chronic");
  });

  it("artan akut + artan kronik", () => {
    const points = [
      { acuteEwma: 300, chronicEwma: 350 },
      { acuteEwma: 330, chronicEwma: 370 },
      { acuteEwma: 360, chronicEwma: 390 },
      { acuteEwma: 400, chronicEwma: 420 },
      { acuteEwma: 440, chronicEwma: 450 },
    ];
    expect(detectEwmaTrend(points)).toBe("rising_both");
  });

  it("azalan akut + stabil kronik → recovery", () => {
    const points = [
      { acuteEwma: 500, chronicEwma: 450 },
      { acuteEwma: 470, chronicEwma: 448 },
      { acuteEwma: 430, chronicEwma: 446 },
      { acuteEwma: 390, chronicEwma: 445 },
      { acuteEwma: 350, chronicEwma: 444 },
    ];
    expect(detectEwmaTrend(points)).toBe("recovery");
  });

  it("deload: akut ve kronik birlikte dusuyor", () => {
    const points = [
      { acuteEwma: 500, chronicEwma: 480 },
      { acuteEwma: 460, chronicEwma: 470 },
      { acuteEwma: 420, chronicEwma: 455 },
      { acuteEwma: 380, chronicEwma: 440 },
      { acuteEwma: 340, chronicEwma: 425 },
    ];
    expect(detectEwmaTrend(points)).toBe("deload");
  });
});

describe("analyzeEwma", () => {
  it("rising_acute_stable_chronic asiri yuklenme uyarisi", () => {
    const r = analyzeEwma({ ewmaRatio: 1.4, trend: "rising_acute_stable_chronic" });
    expect(r.summary).toContain("Artan akut");
    expect(r.riskLevel).toBe("caution");
  });

  it("deload dusuk risk", () => {
    const r = analyzeEwma({ ewmaRatio: 0.9, trend: "deload" });
    expect(r.riskLevel).toBe("low");
    expect(r.summary).toContain("Deload");
  });
});
