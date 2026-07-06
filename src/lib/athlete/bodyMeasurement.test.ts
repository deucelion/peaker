import { describe, expect, it } from "vitest";
import { parseBodyMeasurementInput, parseHeightCm, parseWeightKg } from "./bodyMeasurement";

describe("bodyMeasurement validation", () => {
  it("accepts height only", () => {
    const r = parseBodyMeasurementInput({ measurementDate: "2026-06-10", height: "180", weight: "" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.height).toBe(180);
      expect(r.value.weight).toBeNull();
    }
  });

  it("accepts weight only", () => {
    const r = parseBodyMeasurementInput({ measurementDate: "2026-06-10", height: "", weight: "72.5" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.weight).toBe(72.5);
  });

  it("rejects when both missing", () => {
    const r = parseBodyMeasurementInput({ measurementDate: "2026-06-10", height: "", weight: "" });
    expect(r.ok).toBe(false);
  });

  it("rejects invalid height range", () => {
    expect(parseHeightCm("40")).toBeNull();
    expect(parseHeightCm("270")).toBeNull();
  });

  it("rejects invalid weight range", () => {
    expect(parseWeightKg("10")).toBeNull();
    expect(parseWeightKg("400")).toBeNull();
  });
});
