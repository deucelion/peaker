import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("./logger", () => {
  const calls: Array<{ level: string; scope: string; message: unknown; ctx?: unknown }> = [];
  const fn = (level: string) =>
    vi.fn((scope: string, message: unknown, ctx?: unknown) => {
      calls.push({ level, scope, message, ctx });
    });
  return {
    logger: {
      debug: fn("debug"),
      info: fn("info"),
      warn: fn("warn"),
      error: fn("error"),
      __calls: calls,
    },
  };
});

import { logger } from "./logger";
import {
  reportQueueLatency,
  reportWorkerDuration,
  recordRetryAttempt,
  recordDlqDepth,
  reportMvStaleness,
  reportExportRun,
  reportChartRender,
  reportDashboardQuery,
  advancedTelemetryThresholds,
} from "./index";
import {
  _resetRetryWindowForTests,
  _resetDlqDepthForTests,
} from "./advancedTelemetry";

const mockedLogger = logger as unknown as {
  debug: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  __calls: Array<{ level: string; scope: string; message: unknown; ctx?: unknown }>;
};

function resetCalls() {
  mockedLogger.__calls.length = 0;
  mockedLogger.debug.mockClear();
  mockedLogger.info.mockClear();
  mockedLogger.warn.mockClear();
  mockedLogger.error.mockClear();
}

beforeEach(() => {
  resetCalls();
  _resetRetryWindowForTests();
  _resetDlqDepthForTests();
});

describe("reportQueueLatency", () => {
  it("returns 0 for missing enqueuedAt", () => {
    const ms = reportQueueLatency({
      jobKind: "export.audit",
      queueName: "peaker_jobs",
      organizationId: null,
      enqueuedAt: null,
      startedAt: new Date(),
    });
    expect(ms).toBe(0);
  });

  it("emits info for low latency, warn for high latency", () => {
    const start = new Date();
    reportQueueLatency({
      jobKind: "export.audit",
      queueName: "peaker_jobs",
      organizationId: null,
      enqueuedAt: new Date(start.getTime() - 100),
      startedAt: start,
    });
    expect(mockedLogger.info).toHaveBeenCalledTimes(1);
    expect(mockedLogger.warn).not.toHaveBeenCalled();

    resetCalls();
    reportQueueLatency({
      jobKind: "export.audit",
      queueName: "peaker_jobs",
      organizationId: null,
      enqueuedAt: new Date(start.getTime() - 8_000),
      startedAt: start,
    });
    expect(mockedLogger.warn).toHaveBeenCalledTimes(1);
  });

  it("escalates to error at the error threshold", () => {
    const start = new Date();
    reportQueueLatency({
      jobKind: "export.audit",
      queueName: "peaker_jobs",
      organizationId: null,
      enqueuedAt: new Date(start.getTime() - 60_000),
      startedAt: start,
    });
    expect(mockedLogger.error).toHaveBeenCalledTimes(1);
  });
});

describe("reportWorkerDuration", () => {
  it("info on succeeded under threshold", () => {
    reportWorkerDuration({
      jobKind: "export.audit",
      organizationId: null,
      durationMs: 500,
      status: "succeeded",
    });
    expect(mockedLogger.info).toHaveBeenCalledTimes(1);
  });

  it("warn on failed and error on dead_letter", () => {
    reportWorkerDuration({
      jobKind: "export.audit",
      organizationId: null,
      durationMs: 100,
      status: "failed",
    });
    expect(mockedLogger.warn).toHaveBeenCalled();

    resetCalls();
    reportWorkerDuration({
      jobKind: "export.audit",
      organizationId: null,
      durationMs: 100,
      status: "dead_letter",
    });
    expect(mockedLogger.error).toHaveBeenCalled();
  });
});

describe("retry storms", () => {
  it("emits warn at warn threshold and error at error threshold", () => {
    for (let i = 0; i < advancedTelemetryThresholds.RETRY_STORM_WARN_COUNT; i++) {
      recordRetryAttempt({ jobKind: "export.audit", attempt: i });
    }
    expect(mockedLogger.warn).toHaveBeenCalled();

    resetCalls();
    _resetRetryWindowForTests();
    for (let i = 0; i < advancedTelemetryThresholds.RETRY_STORM_ERROR_COUNT; i++) {
      recordRetryAttempt({ jobKind: "export.audit", attempt: i });
    }
    expect(mockedLogger.error).toHaveBeenCalled();
  });

  it("does not emit below warn threshold", () => {
    recordRetryAttempt({ jobKind: "export.audit", attempt: 1 });
    expect(mockedLogger.info).not.toHaveBeenCalled();
    expect(mockedLogger.warn).not.toHaveBeenCalled();
    expect(mockedLogger.error).not.toHaveBeenCalled();
  });
});

describe("DLQ depth", () => {
  it("computes delta and escalates on growth", () => {
    recordDlqDepth({ queueName: "peaker_jobs_dlq", depth: 5 });
    expect(mockedLogger.info).toHaveBeenCalled();

    resetCalls();
    recordDlqDepth({ queueName: "peaker_jobs_dlq", depth: 30 });
    expect(mockedLogger.warn).toHaveBeenCalled();

    resetCalls();
    recordDlqDepth({ queueName: "peaker_jobs_dlq", depth: 130 });
    expect(mockedLogger.error).toHaveBeenCalled();
  });
});

describe("MV staleness", () => {
  it("returns null and warns if lastRefreshAt missing", () => {
    const r = reportMvStaleness({
      mvName: "daily_training_load_aggregates",
      lastRefreshAt: null,
      source: "read",
    });
    expect(r).toBeNull();
    expect(mockedLogger.warn).toHaveBeenCalled();
  });

  it("info under threshold, error well over", () => {
    const recent = new Date(Date.now() - 60_000);
    reportMvStaleness({ mvName: "x", lastRefreshAt: recent, source: "snapshot" });
    expect(mockedLogger.info).toHaveBeenCalled();

    resetCalls();
    const old = new Date(Date.now() - 60 * 60_000 * 72);
    reportMvStaleness({ mvName: "x", lastRefreshAt: old, source: "snapshot" });
    expect(mockedLogger.error).toHaveBeenCalled();
  });
});

describe("reportExportRun", () => {
  it("info for small fast export, warn when truncated", () => {
    reportExportRun({
      exportKind: "audit",
      organizationId: null,
      rowCount: 100,
      bytes: 10_000,
      durationMs: 200,
      truncated: false,
      source: "stream",
    });
    expect(mockedLogger.info).toHaveBeenCalled();

    resetCalls();
    reportExportRun({
      exportKind: "audit",
      organizationId: null,
      rowCount: 5000,
      bytes: 100_000,
      durationMs: 200,
      truncated: true,
      source: "stream",
    });
    expect(mockedLogger.warn).toHaveBeenCalled();
  });

  it("error when over size or duration error threshold", () => {
    reportExportRun({
      exportKind: "audit",
      organizationId: null,
      rowCount: 10_000,
      bytes: 10_000_000,
      durationMs: 500,
      truncated: false,
      source: "stream",
    });
    expect(mockedLogger.error).toHaveBeenCalled();
  });
});

describe("reportChartRender", () => {
  it("does not log under warn threshold", () => {
    reportChartRender({ chartKey: "k", pointCount: 30, durationMs: 50 });
    expect(mockedLogger.info).not.toHaveBeenCalled();
    expect(mockedLogger.warn).not.toHaveBeenCalled();
  });

  it("warns over warn threshold", () => {
    reportChartRender({ chartKey: "k", pointCount: 30_000, durationMs: 800 });
    expect(mockedLogger.warn).toHaveBeenCalled();
  });
});

describe("reportDashboardQuery", () => {
  it("does not log under warn threshold", () => {
    reportDashboardQuery({
      scope: "performance.snapshot",
      organizationId: null,
      durationMs: 100,
    });
    expect(mockedLogger.info).not.toHaveBeenCalled();
  });

  it("error over error threshold", () => {
    reportDashboardQuery({
      scope: "performance.snapshot",
      organizationId: null,
      durationMs: 10_000,
      rowCount: 1_000_000,
      source: "live",
    });
    expect(mockedLogger.error).toHaveBeenCalled();
  });
});
