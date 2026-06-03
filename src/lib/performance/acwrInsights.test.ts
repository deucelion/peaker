import { describe, expect, it } from "vitest";
import { analyzeAcwr } from "./acwrInsights";

describe("analyzeAcwr (sport science bands)", () => {
  it("< 0.8 → düşük yüklenme", () => {
    const r = analyzeAcwr({ acuteLoad: 70, chronicLoad: 100, acwr: 0.75 });
    expect(r.riskLevel).toBe("low");
  });

  it("0.82 → optimal (sweet spot)", () => {
    const r = analyzeAcwr({ acuteLoad: 82, chronicLoad: 100, acwr: 0.82 });
    expect(r.riskLevel).toBe("optimal");
  });

  it("1.12 → optimal", () => {
    const r = analyzeAcwr({ acuteLoad: 112, chronicLoad: 100, acwr: 1.12 });
    expect(r.riskLevel).toBe("optimal");
  });

  it("1.38 → dikkat (1.3–1.5)", () => {
    const r = analyzeAcwr({ acuteLoad: 138, chronicLoad: 100, acwr: 1.38 });
    expect(r.riskLevel).toBe("caution");
  });

  it("1.65 → yüksek risk (> 1.5)", () => {
    const r = analyzeAcwr({ acuteLoad: 165, chronicLoad: 100, acwr: 1.65 });
    expect(r.riskLevel).toBe("high");
  });
});
