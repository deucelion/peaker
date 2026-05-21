/**
 * FAZ 27 — Production runtime trackers (server + selective client bridge).
 * No PII, no sensitive payloads.
 */

import {
  recordDlqDepth,
  recordRetryAttempt,
  reportDashboardQuery,
  reportExportRun,
  reportQueueLatency,
  reportWorkerDuration,
} from "@/lib/monitoring/advancedTelemetry";
import { logger } from "@/lib/monitoring/logger";
import type { RuntimeSeverity, RuntimeTelemetryScope } from "@/lib/monitoring/runtime/types";

const SLOW_QUERY_WARN_MS = 1_500;
const SLOW_QUERY_ERROR_MS = 5_000;
const SERVER_ACTION_WARN_MS = 1_500;
const SERVER_ACTION_ERROR_MS = 5_000;
const CRON_WARN_MS = 30_000;
const CRON_ERROR_MS = 120_000;
const OFFLINE_REPLAY_WARN_MS = 3_000;
const QUEUE_GROWTH_WARN_PER_HOUR = 200;
const QUEUE_GROWTH_ERROR_PER_HOUR = 500;

let offlineReplayFailureWindow = 0;
let offlineReplayFailureCount = 0;
const OFFLINE_REPLAY_WINDOW_MS = 5 * 60_000;
const OFFLINE_REPLAY_STORM_WARN = 8;
const OFFLINE_REPLAY_STORM_ERROR = 20;

function scopeCtx(scope?: RuntimeTelemetryScope): Record<string, unknown> {
  return {
    organizationId: scope?.organizationId ?? null,
    actorRole: scope?.actorRole ?? null,
    correlationId: scope?.correlationId ?? null,
    requestId: scope?.requestId ?? null,
  };
}

function emit(severity: RuntimeSeverity, scope: string, message: string, ctx: Record<string, unknown>) {
  if (severity === "error") logger.error(scope, message, ctx);
  else if (severity === "warn") logger.warn(scope, message, ctx);
  else logger.info(scope, message, ctx);
}

function levelFromMs(ms: number, warn: number, err: number): RuntimeSeverity {
  if (ms >= err) return "error";
  if (ms >= warn) return "warn";
  return "info";
}

export function trackServerActionDuration(params: {
  action: string;
  durationMs: number;
  ok: boolean;
  scope?: RuntimeTelemetryScope;
}): void {
  const level = params.ok
    ? levelFromMs(params.durationMs, SERVER_ACTION_WARN_MS, SERVER_ACTION_ERROR_MS)
    : "warn";
  emit(level, "runtime.server_action", `${params.action} ${params.durationMs}ms`, {
    ...scopeCtx(params.scope),
    action: params.action,
    durationMs: params.durationMs,
    ok: params.ok,
  });
}

export function trackSlowQuery(params: {
  query: string;
  durationMs: number;
  scope?: RuntimeTelemetryScope;
}): number {
  reportDashboardQuery({
    scope: params.query,
    organizationId: params.scope?.organizationId ?? null,
    durationMs: params.durationMs,
  });
  const level = levelFromMs(params.durationMs, SLOW_QUERY_WARN_MS, SLOW_QUERY_ERROR_MS);
  if (level !== "info") {
    emit(level, "runtime.slow_query", `slow query ${params.durationMs}ms`, {
      ...scopeCtx(params.scope),
      query: params.query,
      durationMs: params.durationMs,
    });
  }
  return params.durationMs;
}

/** Client hooks call via optional bridge — server logs when forwarded in API later. */
export function trackRealtimeReconnect(params: {
  channel: string;
  status: string;
  scope?: RuntimeTelemetryScope;
}): void {
  emit("info", "runtime.realtime.reconnect", `realtime ${params.channel} ${params.status}`, {
    ...scopeCtx(params.scope),
    channel: params.channel,
    status: params.status,
  });
}

export function trackOfflineReplayFailure(params: {
  kind: string;
  failureKind: string;
  scope?: RuntimeTelemetryScope;
}): void {
  const now = Date.now();
  if (now - offlineReplayFailureWindow > OFFLINE_REPLAY_WINDOW_MS) {
    offlineReplayFailureWindow = now;
    offlineReplayFailureCount = 0;
  }
  offlineReplayFailureCount += 1;
  const storm =
    offlineReplayFailureCount >= OFFLINE_REPLAY_STORM_ERROR
      ? "error"
      : offlineReplayFailureCount >= OFFLINE_REPLAY_STORM_WARN
        ? "warn"
        : "info";
  emit(storm, "runtime.offline.replay_failure", "offline replay failure", {
    ...scopeCtx(params.scope),
    kind: params.kind,
    failureKind: params.failureKind,
    windowCount: offlineReplayFailureCount,
  });
}

export function trackOfflineReplayBatch(params: {
  processed: number;
  succeeded: number;
  failed: number;
  durationMs: number;
  scope?: RuntimeTelemetryScope;
}): void {
  const level = levelFromMs(params.durationMs, OFFLINE_REPLAY_WARN_MS, OFFLINE_REPLAY_WARN_MS * 3);
  emit(level, "runtime.offline.replay_batch", "offline replay batch", {
    ...scopeCtx(params.scope),
    processed: params.processed,
    succeeded: params.succeeded,
    failed: params.failed,
    durationMs: params.durationMs,
  });
}

export function trackWorkerHeartbeat(params: {
  workerId: string;
  processedCount: number;
  failedCount: number;
  durationMs: number;
  isActive: boolean;
  scope?: RuntimeTelemetryScope;
}): void {
  reportWorkerDuration({
    jobKind: "worker.tick",
    organizationId: params.scope?.organizationId ?? null,
    durationMs: params.durationMs,
    status: params.isActive ? "succeeded" : "failed",
  });
  if (!params.isActive) {
    emit("warn", "runtime.worker.heartbeat", "worker heartbeat stale", {
      ...scopeCtx(params.scope),
      workerId: params.workerId,
      processedCount: params.processedCount,
      failedCount: params.failedCount,
    });
  }
}

export function trackExportDuration(params: {
  kind: string;
  durationMs: number;
  rowCount: number | null;
  truncated?: boolean;
  scope?: RuntimeTelemetryScope;
}): void {
  reportExportRun({
    exportKind: params.kind,
    durationMs: params.durationMs,
    rowCount: params.rowCount ?? 0,
    bytes: null,
    truncated: params.truncated ?? false,
    organizationId: params.scope?.organizationId ?? null,
    source: "stream",
  });
}

export function trackQueueGrowth(params: {
  jobsLast60Min: number;
  queuedTotal: number;
  dlqCount: number;
  scope?: RuntimeTelemetryScope;
}): void {
  recordDlqDepth({ queueName: "peaker_jobs_dlq", depth: params.dlqCount });
  const perHour = params.jobsLast60Min;
  const level =
    perHour >= QUEUE_GROWTH_ERROR_PER_HOUR
      ? "error"
      : perHour >= QUEUE_GROWTH_WARN_PER_HOUR
        ? "warn"
        : "info";
  if (level !== "info") {
    emit(level, "runtime.queue.growth", "queue enqueue spike", {
      ...scopeCtx(params.scope),
      jobsLast60Min: perHour,
      queuedTotal: params.queuedTotal,
      dlqCount: params.dlqCount,
    });
  }
}

export function trackCronExecution(params: {
  jobName: string;
  durationMs: number;
  status: string;
  scope?: RuntimeTelemetryScope;
}): void {
  const level =
    params.status === "failed"
      ? "error"
      : levelFromMs(params.durationMs, CRON_WARN_MS, CRON_ERROR_MS);
  emit(level, "runtime.cron", `cron ${params.jobName} ${params.status}`, {
    ...scopeCtx(params.scope),
    jobName: params.jobName,
    durationMs: params.durationMs,
    status: params.status,
  });
}

export function trackRetryAttempt(params: { jobKind: string; attempt: number }): void {
  recordRetryAttempt({ jobKind: params.jobKind, attempt: params.attempt });
}

export function trackQueueJobLatency(params: {
  jobKind: string;
  queueName: string;
  organizationId: string | null;
  enqueuedAt: string | Date | null;
  startedAt: string | Date;
}): number {
  return reportQueueLatency(params);
}

/** Test-only reset */
export function resetRuntimeTrackersForTests(): void {
  offlineReplayFailureWindow = 0;
  offlineReplayFailureCount = 0;
}
