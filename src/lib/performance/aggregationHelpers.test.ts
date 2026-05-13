import { describe, it, expect } from "vitest";
import {
  planProfileLoadFetch,
  trainingLoadsSelectClause,
  PROFILE_LOAD_FETCH_HARD_CAP,
  PROFILE_LOAD_FETCH_SOFT_CAP,
} from "./aggregationHelpers";

describe("aggregationHelpers — planProfileLoadFetch", () => {
  it("dedupes and preserves order", () => {
    const ids = ["a", "b", "a", "c"];
    const plan = planProfileLoadFetch(ids, { mode: "team", scope: "test" });
    expect(plan.profileIds).toEqual(["a", "b", "c"]);
    expect(plan.overSoftCap).toBe(false);
    expect(plan.cappedAtHard).toBe(false);
  });

  it("single mode requires profile join", () => {
    const plan = planProfileLoadFetch(["x"], { mode: "single", scope: "test" });
    expect(plan.needsProfileJoin).toBe(true);
  });

  it("team mode skips profile join", () => {
    const plan = planProfileLoadFetch(["x", "y"], { mode: "team", scope: "test" });
    expect(plan.needsProfileJoin).toBe(false);
  });

  it("flags soft cap", () => {
    const ids = Array.from(
      { length: PROFILE_LOAD_FETCH_SOFT_CAP + 5 },
      (_, i) => `id-${i}`
    );
    const plan = planProfileLoadFetch(ids, { mode: "team", scope: "test" });
    expect(plan.overSoftCap).toBe(true);
    expect(plan.cappedAtHard).toBe(false);
    expect(plan.profileIds.length).toBe(PROFILE_LOAD_FETCH_SOFT_CAP + 5);
  });

  it("caps at hard cap", () => {
    const ids = Array.from(
      { length: PROFILE_LOAD_FETCH_HARD_CAP + 50 },
      (_, i) => `id-${i}`
    );
    const plan = planProfileLoadFetch(ids, { mode: "team", scope: "test" });
    expect(plan.cappedAtHard).toBe(true);
    expect(plan.profileIds.length).toBe(PROFILE_LOAD_FETCH_HARD_CAP);
  });

  it("filters empty ids", () => {
    const plan = planProfileLoadFetch(["a", "", "b"], { mode: "team", scope: "test" });
    expect(plan.profileIds).toEqual(["a", "b"]);
  });
});

describe("aggregationHelpers — trainingLoadsSelectClause", () => {
  it("includes profile join when single mode", () => {
    expect(trainingLoadsSelectClause(true)).toContain("profiles(");
  });

  it("omits profile join when team mode", () => {
    expect(trainingLoadsSelectClause(false)).not.toContain("profiles(");
  });
});
