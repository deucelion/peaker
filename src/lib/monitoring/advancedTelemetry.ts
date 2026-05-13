/**
 * Faz 12.7 — Advanced telemetry primitives.
 *
 * Hedef:
 *   Faz 7.5 `logger` + Faz 7.5 `startTiming` üzerine, Faz 12 operasyon
 *   profilini gözlemlenebilir kılan domain-spesifik telemetri yardımcıları:
 *     - queue latency (enqueue → start)
 *     - worker duration (start → finish)
 *     - retry storms (kısa pencerede tekrar eden başarısızlıklar)
 *     - DLQ growth
 *     - MV staleness
 *     - export duration & size
 *     - slow chart render
 *     - slow dashboard query
 *
 * Tasarım:
 *   - Tüm helper'lar `logger` üzerinden structured log üretir; eşik aşımında
 *     `warn`, kritik aşımda `error` seviyesine yükselir.
 *   - Hiçbir helper exception fırlatmaz; telemetry hot path'i bozmamalı.
 *   - Server-side only (Next.js route / server action / worker context).
 *
 * Memory:
 *   - In-memory counter'lar (retry storm window, DLQ deltas) instance scope'ta;
 *     multi-instance deployment'ta her instance kendi penceresini tutar.
 *     Production'da bu yeterli (eşik aşımı yine log üzerinden Sentry'ye iletilir);
 *     gerçek metrics aggregation Faz 13'te (OpenTelemetry / Datadog).
 *
 * PII:
 *   - Telemetri context'i sadece kimliklendirilmemiş scope'lar (org_id, kind,
 *     queue, rowCount) içerir. Kullanıcı verisi (mesaj, email, profile alanı)
 *     buraya geçirilmez.
 */

import { logger } from "./logger";

const QUEUE_LATENCY_WARN_MS = 5_000;
const QUEUE_LATENCY_ERROR_MS = 30_000;

const WORKER_DURATION_WARN_MS = 10_000;
const WORKER_DURATION_ERROR_MS = 60_000;

const EXPORT_DURATION_WARN_MS = 5_000;
const EXPORT_DURATION_ERROR_MS = 20_000;

const EXPORT_SIZE_WARN_BYTES = 2_000_000;
const EXPORT_SIZE_ERROR_BYTES = 5_000_000;

const DASHBOARD_QUERY_WARN_MS = 1_500;
const DASHBOARD_QUERY_ERROR_MS = 5_000;

const CHART_RENDER_WARN_MS = 500;
const CHART_RENDER_ERROR_MS = 2_000;

const MV_STALENESS_WARN_MIN = 60 * 24; // 24h
const MV_STALENESS_ERROR_MIN = 60 * 48; // 48h

const DLQ_GROWTH_WARN = 20;
const DLQ_GROWTH_ERROR = 100;

const RETRY_STORM_WINDOW_MS = 5 * 60_000;
const RETRY_STORM_WARN_COUNT = 10;
const RETRY_STORM_ERROR_COUNT = 30;

const ROW_LARGE_HINT_THRESHOLD = 8_000;

type LevelDecision = "info" | "warn" | "error";

function chooseLevel(value: number, warnAt: number, errorAt: number): LevelDecision {
  if (!Number.isFinite(value)) return "info";
  if (value >= errorAt) return "error";
  if (value >= warnAt) return "warn";
  return "info";
}

function emit(level: LevelDecision, scope: string, message: string, ctx: Record<string, unknown>) {
  if (level === "error") logger.error(scope, message, ctx);
  else if (level === "warn") logger.warn(scope, message, ctx);
  else logger.info(scope, message, ctx);
}

/* -------------------------------------------------------------------------- */
/* 1) Queue latency (enqueue → start)                                          */
/* -------------------------------------------------------------------------- */

export function reportQueueLatency(params: {
  jobKind: string;
  queueName: string;
  organizationId: string | null;
  enqueuedAt: string | Date | null;
  startedAt: string | Date;
}): number {
  const start = toDate(params.startedAt);
  const enq = params.enqueuedAt ? toDate(params.enqueuedAt) : null;
  if (!start || !enq) return 0;
  const latencyMs = Math.max(0, start.getTime() - enq.getTime());
  const level = chooseLevel(latencyMs, QUEUE_LATENCY_WARN_MS, QUEUE_LATENCY_ERROR_MS);
  emit(level, "telemetry.queue.latency", `queue latency ${latencyMs}ms`, {
    jobKind: params.jobKind,
    queueName: params.queueName,
    organizationId: params.organizationId,
    latencyMs,
  });
  return latencyMs;
}

/* -------------------------------------------------------------------------- */
/* 2) Worker duration (start → finish)                                         */
/* -------------------------------------------------------------------------- */

export function reportWorkerDuration(params: {
  jobKind: string;
  organizationId: string | null;
  durationMs: number;
  status: "succeeded" | "failed" | "dead_letter" | "cancelled";
  attempts?: number;
}): void {
  const duration = Math.max(0, params.durationMs);
  const level =
    params.status === "succeeded"
      ? chooseLevel(duration, WORKER_DURATION_WARN_MS, WORKER_DURATION_ERROR_MS)
      : params.status === "dead_letter"
        ? "error"
        : "warn";
  emit(level, "telemetry.worker.duration", `worker ${params.status} ${duration}ms`, {
    jobKind: params.jobKind,
    organizationId: params.organizationId,
    durationMs: duration,
    status: params.status,
    attempts: params.attempts,
  });
}

/* -------------------------------------------------------------------------- */
/* 3) Retry storms (in-memory rolling window)                                  */
/* -------------------------------------------------------------------------- */

type RetryWindowEntry = { ts: number; jobKind: string };
const retryWindow: RetryWindowEntry[] = [];

function pruneRetryWindow(now: number) {
  const cutoff = now - RETRY_STORM_WINDOW_MS;
  while (retryWindow.length > 0 && retryWindow[0].ts < cutoff) {
    retryWindow.shift();
  }
}

export function recordRetryAttempt(params: { jobKind: string; attempt: number }): boolean {
  const now = Date.now();
  pruneRetryWindow(now);
  retryWindow.push({ ts: now, jobKind: params.jobKind });
  const count = retryWindow.filter((e) => e.jobKind === params.jobKind).length;
  const level = chooseLevel(count, RETRY_STORM_WARN_COUNT, RETRY_STORM_ERROR_COUNT);
  if (level !== "info") {
    emit(level, "telemetry.worker.retry_storm", `retry storm detected: ${count}/${RETRY_STORM_WINDOW_MS / 60_000}m`, {
      jobKind: params.jobKind,
      attempt: params.attempt,
      windowMs: RETRY_STORM_WINDOW_MS,
      retriesInWindow: count,
    });
    return true;
  }
  return false;
}

export function _resetRetryWindowForTests() {
  retryWindow.length = 0;
}

/* -------------------------------------------------------------------------- */
/* 4) DLQ growth tracking                                                      */
/* -------------------------------------------------------------------------- */

const lastDlqDepth = new Map<string, number>();

export function recordDlqDepth(params: { queueName: string; depth: number }): number {
  const queue = params.queueName;
  const prev = lastDlqDepth.get(queue) ?? 0;
  const depth = Math.max(0, params.depth);
  const delta = depth - prev;
  lastDlqDepth.set(queue, depth);
  const level = chooseLevel(Math.max(delta, depth), DLQ_GROWTH_WARN, DLQ_GROWTH_ERROR);
  emit(level, "telemetry.queue.dlq", `dlq ${queue} depth=${depth} delta=${delta}`, {
    queueName: queue,
    depth,
    delta,
  });
  return delta;
}

export function _resetDlqDepthForTests() {
  lastDlqDepth.clear();
}

/* -------------------------------------------------------------------------- */
/* 5) MV staleness                                                             */
/* -------------------------------------------------------------------------- */

export function reportMvStaleness(params: {
  mvName: string;
  lastRefreshAt: string | Date | null;
  source: "snapshot" | "read" | "cron";
}): number | null {
  const ts = params.lastRefreshAt ? toDate(params.lastRefreshAt) : null;
  if (!ts) {
    logger.warn("telemetry.mv.staleness", "mv lastRefreshAt missing", {
      mvName: params.mvName,
      source: params.source,
    });
    return null;
  }
  const ageMin = Math.max(0, Math.floor((Date.now() - ts.getTime()) / 60_000));
  const level = chooseLevel(ageMin, MV_STALENESS_WARN_MIN, MV_STALENESS_ERROR_MIN);
  emit(level, "telemetry.mv.staleness", `mv ${params.mvName} age=${ageMin}m`, {
    mvName: params.mvName,
    ageMinutes: ageMin,
    source: params.source,
  });
  return ageMin;
}

/* -------------------------------------------------------------------------- */
/* 6) Export duration + size                                                   */
/* -------------------------------------------------------------------------- */

/** Faz 14.1 — HTTP stream export terminal durumları (Sentry/log aggregation). */
export type ExportStreamTerminalKind =
  | "export_aborted"
  | "export_timeout"
  | "export_partial_stream"
  | "export_client_disconnect";

export function reportExportStreamTerminal(params: {
  kind: ExportStreamTerminalKind;
  exportKind: string;
  organizationId: string | null;
  rowCountEmitted: number;
  durationMs: number;
  truncated: boolean;
}): void {
  const duration = Math.max(0, params.durationMs);
  const level: LevelDecision =
    params.kind === "export_timeout" || params.kind === "export_partial_stream" ? "warn" : "info";
  emit(level, "telemetry.export.stream", params.kind, {
    exportKind: params.exportKind,
    organizationId: params.organizationId,
    rowCountEmitted: params.rowCountEmitted,
    durationMs: duration,
    truncated: params.truncated,
  });
}

export function reportExportRun(params: {
  exportKind: string;
  organizationId: string | null;
  rowCount: number;
  bytes: number | null;
  durationMs: number;
  truncated: boolean;
  source: "sync" | "stream" | "worker";
}): void {
  const duration = Math.max(0, params.durationMs);
  const bytes = params.bytes ?? null;
  const durationLevel = chooseLevel(duration, EXPORT_DURATION_WARN_MS, EXPORT_DURATION_ERROR_MS);
  const sizeLevel =
    bytes == null ? "info" : chooseLevel(bytes, EXPORT_SIZE_WARN_BYTES, EXPORT_SIZE_ERROR_BYTES);
  const level: LevelDecision =
    durationLevel === "error" || sizeLevel === "error"
      ? "error"
      : durationLevel === "warn" || sizeLevel === "warn" || params.truncated
        ? "warn"
        : "info";
  emit(level, "telemetry.export.run", `export ${params.exportKind} ${duration}ms`, {
    exportKind: params.exportKind,
    organizationId: params.organizationId,
    rowCount: params.rowCount,
    bytes,
    durationMs: duration,
    truncated: params.truncated,
    source: params.source,
    largeRowHint: params.rowCount >= ROW_LARGE_HINT_THRESHOLD ? true : undefined,
  });
}

/* -------------------------------------------------------------------------- */
/* 7) Slow chart render (client-side helper)                                   */
/* -------------------------------------------------------------------------- */

export function reportChartRender(params: {
  chartKey: string;
  pointCount: number;
  durationMs: number;
}): void {
  const duration = Math.max(0, params.durationMs);
  const level = chooseLevel(duration, CHART_RENDER_WARN_MS, CHART_RENDER_ERROR_MS);
  if (level === "info") return;
  emit(level, "telemetry.chart.render", `chart ${params.chartKey} ${duration}ms`, {
    chartKey: params.chartKey,
    pointCount: params.pointCount,
    durationMs: duration,
  });
}

/* -------------------------------------------------------------------------- */
/* 8) Slow dashboard query                                                     */
/* -------------------------------------------------------------------------- */

export function reportDashboardQuery(params: {
  scope: string;
  organizationId: string | null;
  durationMs: number;
  rowCount?: number;
  source?: "live" | "snapshot" | "mv";
}): void {
  const duration = Math.max(0, params.durationMs);
  const level = chooseLevel(duration, DASHBOARD_QUERY_WARN_MS, DASHBOARD_QUERY_ERROR_MS);
  if (level === "info") return;
  emit(level, "telemetry.dashboard.query", `dashboard.${params.scope} ${duration}ms`, {
    scope: params.scope,
    organizationId: params.organizationId,
    durationMs: duration,
    rowCount: params.rowCount,
    source: params.source,
  });
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                     */
/* -------------------------------------------------------------------------- */

function toDate(v: string | Date): Date | null {
  if (v instanceof Date) {
    return Number.isFinite(v.getTime()) ? v : null;
  }
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

export const __thresholds = {
  QUEUE_LATENCY_WARN_MS,
  QUEUE_LATENCY_ERROR_MS,
  WORKER_DURATION_WARN_MS,
  WORKER_DURATION_ERROR_MS,
  EXPORT_DURATION_WARN_MS,
  EXPORT_DURATION_ERROR_MS,
  EXPORT_SIZE_WARN_BYTES,
  EXPORT_SIZE_ERROR_BYTES,
  DASHBOARD_QUERY_WARN_MS,
  DASHBOARD_QUERY_ERROR_MS,
  CHART_RENDER_WARN_MS,
  CHART_RENDER_ERROR_MS,
  MV_STALENESS_WARN_MIN,
  MV_STALENESS_ERROR_MIN,
  DLQ_GROWTH_WARN,
  DLQ_GROWTH_ERROR,
  RETRY_STORM_WINDOW_MS,
  RETRY_STORM_WARN_COUNT,
  RETRY_STORM_ERROR_COUNT,
};
