import { describe, expect, it } from "vitest";
import {
  resolveAthleteFieldTestDateRange,
  resolveAthleteFieldTestSelectedNames,
} from "./athleteFieldTestFilter";

describe("resolveAthleteFieldTestSelectedNames", () => {
  it("defaults to all names without a deferred empty selection flash", () => {
    expect(resolveAthleteFieldTestSelectedNames(["A", "B"], null)).toEqual(["A", "B"]);
    expect(resolveAthleteFieldTestSelectedNames(["A", "B"], [])).toEqual(["A", "B"]);
  });

  it("keeps valid user selections", () => {
    expect(resolveAthleteFieldTestSelectedNames(["A", "B", "C"], ["B", "X"])).toEqual(["B"]);
  });
});

describe("resolveAthleteFieldTestDateRange", () => {
  it("derives inclusive bounds from result dates when filters are unset", () => {
    expect(
      resolveAthleteFieldTestDateRange(
        [{ test_date: "2026-03-10" }, { test_date: "2026-01-02T12:00:00Z" }],
        "",
        ""
      )
    ).toEqual({ from: "2026-01-02", to: "2026-03-10" });
  });

  it("preserves explicit user range", () => {
    expect(
      resolveAthleteFieldTestDateRange([{ test_date: "2026-03-10" }], "2026-02-01", "2026-02-28")
    ).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
});
