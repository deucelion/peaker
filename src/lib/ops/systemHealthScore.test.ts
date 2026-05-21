import { describe, expect, it } from "vitest";
import { computeProductionHealthScores } from "@/lib/ops/systemHealthScore";
import type { SystemOperationsSnapshot } from "@/lib/actions/systemOperationsTypes";

function minimalSnapshot(overrides: Partial<SystemOperationsSnapshot> = {}): SystemOperationsSnapshot {
  return {
    cronAvailable: true,
    cronJobs: [],
    recentRetentionRuns: [],
    materializedViews: [],
    mvFreshness: [],
    queueStats: {
      available: true,
      total: 0,
      byStatus: { queued: 0 },
      failedRecentCount: 0,
      oldestQueuedAt: null,
      deadLetterCount: 0,
      averageDurationMs: null,
      p95DurationMs: null,
    },
    recentJobs: [],
    activeWorkers: [{ workerId: "w1", source: "api", lastTickAt: new Date().toISOString(), processedCount: 1, succeededCount: 1, failedCount: 0, deadLetterCount: 0, durationMs: 100, isActive: true }],
    exportDurationSamples: [],
    workerRecovery24h: { rescuedJobs: 0, deadJobs: 0, retryStorms: 0 },
    operationalAlerts: [],
    operationalTimeline: [],
    rateLimiterRuntime: {
      limiterFallbackCount: 0,
      limiterDegradedHits: 0,
      limiterUnhealthyBackendHits: 0,
      lastLimiterFailureReason: null,
      activeAdapter: "memory",
      fallbackAdapter: "memory",
      recentAdapterSwitches: [],
    },
    activeExportJobsCount: 0,
    queueAnalyticsBrief: {
      jobsEnqueuedLast60Min: 0,
      jobsPerMinuteEstimate: 0,
      multiAttemptFraction: 0,
      dlqInSample: 0,
      avgExecutionMs: null,
      p95ExecutionMs: null,
      exportsFinishedLast24h: 0,
      exportRowsLast24h: 0,
      exportRowsPerMinuteEstimate: null,
      workerPulseActive: 1,
      workerPulseTotal: 1,
    },
    openOperationalAlertsCount: 0,
    jobsScopeOrganizationId: null,
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("computeProductionHealthScores", () => {
  it("returns healthy when metrics are clean", () => {
    const s = computeProductionHealthScores(minimalSnapshot());
    expect(s.overall).toBeGreaterThanOrEqual(70);
    expect(s.label).toBe("healthy");
  });

  it("degrades with critical alerts", () => {
    const s = computeProductionHealthScores(
      minimalSnapshot({
        operationalAlerts: [
          {
            id: "1",
            ruleKey: "test",
            severity: "critical",
            title: "x",
            detail: {},
            organizationId: null,
            createdAt: new Date().toISOString(),
            resolvedAt: null,
            acknowledgedAt: null,
            acknowledgedBy: null,
            escalationCount: 0,
            lastEscalatedAt: null,
            noiseSuppressed: false,
          },
        ],
        openOperationalAlertsCount: 1,
      })
    );
    expect(s.label).not.toBe("healthy");
  });
});
