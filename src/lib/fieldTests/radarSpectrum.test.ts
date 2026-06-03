import { describe, expect, it } from "vitest";
import { buildAthleteRadarSpectrum } from "./radarSpectrum";

describe("buildAthleteRadarSpectrum", () => {
  it("limits to 8 tests and normalizes scores", () => {
    const results = Array.from({ length: 12 }, (_, i) => ({
      value: 10 + i,
      test_date: `2026-01-${String(i + 1).padStart(2, "0")}T12:00:00Z`,
      test_definitions: { name: `Test ${i + 1}`, unit: "sn" },
    }));

    const points = buildAthleteRadarSpectrum(results, { maxPoints: 8 });
    expect(points).toHaveLength(8);
    expect(points[0]!.A).toBeGreaterThanOrEqual(0);
    expect(points[0]!.A).toBeLessThanOrEqual(100);
    expect(points[0]!.fullName).toBe("Test 12");
  });

  it("uses truncated subject labels", () => {
    const points = buildAthleteRadarSpectrum([
      {
        value: 42,
        test_date: "2026-06-01T12:00:00Z",
        test_definitions: { name: "Very Long Test Name Here", unit: "cm" },
      },
    ]);
    expect(points[0]!.subject.length).toBeLessThanOrEqual(12);
    expect(points[0]!.fullName).toBe("Very Long Test Name Here");
  });
});
