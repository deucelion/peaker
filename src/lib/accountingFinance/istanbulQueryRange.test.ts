import { describe, expect, it } from "vitest";
import {
  MAX_ACCOUNTING_CUSTOM_RANGE_DAYS,
  wallDateRangeDayCountInclusive,
} from "./istanbulQueryRange";

describe("wallDateRangeDayCountInclusive", () => {
  it("counts inclusive days in same month", () => {
    expect(wallDateRangeDayCountInclusive("2026-06-01", "2026-06-10")).toBe(10);
  });

  it("counts cross-month range", () => {
    expect(wallDateRangeDayCountInclusive("2026-05-30", "2026-06-02")).toBe(4);
  });

  it("returns null for invalid range", () => {
    expect(wallDateRangeDayCountInclusive("2026-06-10", "2026-06-01")).toBeNull();
    expect(wallDateRangeDayCountInclusive("bad", "2026-06-01")).toBeNull();
  });

  it("allows one-year cap constant", () => {
    expect(wallDateRangeDayCountInclusive("2025-06-10", "2026-06-09")).toBe(365);
    expect(MAX_ACCOUNTING_CUSTOM_RANGE_DAYS).toBe(366);
  });
});
