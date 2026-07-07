import { describe, expect, it, vi } from "vitest";
import { PERFORMANCE_TABS, isPerformanceTabActive } from "@/lib/navigation/performanceTabs";
import { hrefWellnessArchive, parseWellnessArchiveSearchParams } from "@/lib/navigation/wellnessArchiveLinks";
import { hrefPerformansWithAthlete, parsePerformansSearchParams } from "@/lib/navigation/performanceLinks";
import { resolveAthleteDetailBackLink } from "@/lib/navigation/athleteDetailBackLink";
import { loadPerformancePreferences, savePerformancePreferences, clearPerformancePreferences } from "@/lib/performance/performancePreferences";

describe("performanceTabs", () => {
  it("exposes three stable tabs", () => {
    expect(PERFORMANCE_TABS).toHaveLength(3);
    expect(isPerformanceTabActive(PERFORMANCE_TABS[0], "yuk")).toBe(true);
  });
});

describe("wellnessArchiveLinks", () => {
  it("builds filtered archive href", () => {
    expect(hrefWellnessArchive({ athleteId: "abc", athleteName: "Ali" })).toContain("sporcu=abc");
    expect(hrefWellnessArchive({ athleteId: "abc", athleteName: "Ali" })).toContain("q=Ali");
  });

  it("parses search params", () => {
    expect(parseWellnessArchiveSearchParams({ sporcu: "x", q: "Ali" }).athleteId).toBe("x");
  });
});

describe("performanceLinks", () => {
  it("builds performans athlete link", () => {
    expect(hrefPerformansWithAthlete("id-1", "28")).toContain("sporcu=id-1");
    expect(hrefPerformansWithAthlete("id-1", "28")).toContain("range=28");
  });

  it("parses performans params", () => {
    expect(parsePerformansSearchParams({ sporcu: "a", range: "14" }).range).toBe("14");
  });
});

describe("athleteDetailBackLink", () => {
  it("returns session back link when oturum date provided", () => {
    const link = resolveAthleteDetailBackLink("saha-testleri", { sessionDate: "2026-07-07" });
    expect(link.href).toContain("/oturum/2026-07-07");
  });
});

describe("performancePreferences", () => {
  it("roundtrips session preferences", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, v);
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
    });
    clearPerformancePreferences();
    savePerformancePreferences({ selectedAthleteId: "p1", viewMode: "team" });
    expect(loadPerformancePreferences().selectedAthleteId).toBe("p1");
    expect(loadPerformancePreferences().viewMode).toBe("team");
    clearPerformancePreferences();
    vi.unstubAllGlobals();
  });
});
