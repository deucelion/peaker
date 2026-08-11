import { describe, expect, it } from "vitest";
import { isStaleDashboardFetchRun } from "./dashboardFetchGuard";

describe("dashboardFetchGuard", () => {
  it("treats older run ids as stale after a newer fetch started", () => {
    expect(isStaleDashboardFetchRun(1, 2)).toBe(true);
    expect(isStaleDashboardFetchRun(2, 2)).toBe(false);
  });

  it("simulates concurrent fetch: newer result wins", () => {
    let latestRunId = 0;
    let dashboardOrgName = "INITIAL";

    const runA = ++latestRunId;
    const runB = ++latestRunId;

    const resultB = { orgName: "NEW" };
    if (!isStaleDashboardFetchRun(runB, latestRunId)) {
      dashboardOrgName = resultB.orgName;
    }

    const resultA = { orgName: "OLD" };
    if (!isStaleDashboardFetchRun(runA, latestRunId)) {
      dashboardOrgName = resultA.orgName;
    }

    expect(dashboardOrgName).toBe("NEW");
  });

  it("simulates A fail then B success — loadError stays clear when B wins", () => {
    let latestRunId = 0;
    let loadError: string | null = "INITIAL";
    const runA = ++latestRunId;
    const runB = ++latestRunId;

    if (!isStaleDashboardFetchRun(runB, latestRunId)) {
      loadError = null;
    }

    if (!isStaleDashboardFetchRun(runA, latestRunId)) {
      loadError = "Panel verileri yuklenemedi.";
    }

    expect(loadError).toBeNull();
  });
});
