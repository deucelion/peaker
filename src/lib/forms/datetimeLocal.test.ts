import { describe, expect, it } from "vitest";
import { combineLocalDateAndTime, splitIsoToDateAndTime } from "./datetimeLocal";

describe("datetimeLocal", () => {
  it("splitIsoToDateAndTime round-trips with combine", () => {
    const iso = "2026-06-15T14:30:00.000Z";
    const { date, time } = splitIsoToDateAndTime(iso);
    const combined = combineLocalDateAndTime(date, time);
    expect(combined.length).toBeGreaterThan(10);
    expect(combined.startsWith(date)).toBe(true);
  });
});
