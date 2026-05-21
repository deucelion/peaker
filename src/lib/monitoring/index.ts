/**
 * Faz 7.5 — Monitoring barrel.
 *
 * Yeni server-side observability primitives'i için tek import noktası.
 * Mevcut `@/lib/observability/serverActionError` korunur; bu modül üzerinde inşa edilir.
 */

export { logger } from "./logger";
export type { LogContext, LogLevel } from "./logger";
export { startTiming, measure } from "./timing";
export { measureAction, measureQuery, startActionTelemetry, attachAttribute, type ActionTelemetry, type ActionSeverity } from "./telemetry";
export { runNotificationsRetention, runAuditLogsRetention, type RetentionRunResult } from "./retentionHealth";
export {
  runJobsRetention,
  type JobsRetentionRunResult,
  type JobsRetentionScope,
} from "./jobsRetentionHealth";
export {
  reportQueueLatency,
  reportWorkerDuration,
  recordRetryAttempt,
  recordDlqDepth,
  reportMvStaleness,
  reportExportRun,
  reportChartRender,
  reportDashboardQuery,
  __thresholds as advancedTelemetryThresholds,
} from "./advancedTelemetry";
export * from "./runtime";
