import { describe, it, expect } from "vitest";
import { evaluateOperationalAlerts } from "./alertRules";

describe("evaluateOperationalAlerts", () => {
  it("returns empty when all metrics are calm", () => {
    const r = evaluateOperationalAlerts({
      oldestQueuedAgeMinutes: 2,
      deadLetterSampleCount: 0,
      exportDurationP95Ms: 1000,
      mvCriticalNames: [],
      mvStaleNames: [],
      workerRescued24h: 0,
      workerDeadStuck24h: 0,
      workerRetryStorms24h: 0,
    });
    expect(r).toEqual([]);
  });

  it("flags critical MV names", () => {
    const r = evaluateOperationalAlerts({
      oldestQueuedAgeMinutes: null,
      deadLetterSampleCount: 0,
      exportDurationP95Ms: null,
      mvCriticalNames: ["monthly_finance_summary"],
      mvStaleNames: [],
      workerRescued24h: 0,
      workerDeadStuck24h: 0,
      workerRetryStorms24h: 0,
    });
    expect(r.some((x) => x.severity === "critical" && x.ruleKey.includes("monthly_finance_summary"))).toBe(
      true
    );
  });
});
