/**
 * Faz 15 — Sistem operasyonları snapshot tipleri (use server dosyasından ayrıldı).
 */

export type CronJobStatus = {
  jobname: string;
  schedule?: string | null;
  active?: boolean | null;
  lastRunStatus?: string | null;
  lastRunStartedAt?: string | null;
  lastRunDurationMs?: number | null;
  lastRunMessage?: string | null;
};

export type RetentionRunRow = {
  jobname: string;
  startTime: string;
  endTime: string | null;
  status: string;
  returnMessage: string | null;
  durationMs: number | null;
};

export type MaterializedViewStatus = {
  name: string;
  refreshedAt?: string | null;
  rowCount?: number | null;
  available: boolean;
  reason?: string;
};

export type RecentJobRow = {
  id: string;
  organizationId: string | null;
  kind: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  enqueuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorKind: string | null;
  errorMessage: string | null;
};

export type QueueStats = {
  available: boolean;
  reason?: string;
  total: number;
  byStatus: Record<string, number>;
  failedRecentCount: number;
  oldestQueuedAt: string | null;
  deadLetterCount: number;
  averageDurationMs: number | null;
  p95DurationMs: number | null;
};

export type WorkerHeartbeatRow = {
  workerId: string;
  source: string;
  lastTickAt: string;
  processedCount: number;
  succeededCount: number;
  failedCount: number;
  deadLetterCount: number;
  durationMs: number;
  isActive: boolean;
  rescueRescuedCount?: number;
  rescueDeadStuckCount?: number;
  retryStormDetected?: boolean;
};

export type WorkerRecovery24h = {
  rescuedJobs: number;
  deadJobs: number;
  retryStorms: number;
};

export type OperationalAlertRow = {
  id: string;
  ruleKey: string;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: Record<string, unknown>;
  organizationId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  escalationCount: number;
  lastEscalatedAt: string | null;
  noiseSuppressed: boolean;
};

export type OperationalTimelineRow = {
  id: string;
  eventType: string;
  severity: "info" | "warning" | "critical";
  summary: string;
  organizationId: string | null;
  createdAt: string;
  payload: Record<string, unknown>;
};

export type ExportDurationSample = {
  finishedAt: string;
  kind: string;
  durationMs: number;
  rowCount: number | null;
  truncated: boolean;
};

export type MvFreshnessStatus = {
  name: string;
  refreshedAt: string | null;
  ageMinutes: number | null;
  staleDurationSeconds: number | null;
  refreshDurationMs: number | null;
  staleness: "fresh" | "stale" | "critical" | "missing";
};

export type QueueAnalyticsBrief = {
  jobsEnqueuedLast60Min: number;
  jobsPerMinuteEstimate: number | null;
  multiAttemptFraction: number | null;
  dlqInSample: number;
  avgExecutionMs: number | null;
  p95ExecutionMs: number | null;
  exportsFinishedLast24h: number;
  exportRowsLast24h: number;
  exportRowsPerMinuteEstimate: number | null;
  workerPulseActive: number;
  workerPulseTotal: number;
};

export type RateLimiterRuntimeSnapshot = {
  limiterFallbackCount: number;
  limiterDegradedHits: number;
  limiterUnhealthyBackendHits: number;
  lastLimiterFailureReason: string | null;
  activeAdapter: string;
  fallbackAdapter: string;
  recentAdapterSwitches: ReadonlyArray<{ switchedAt: string; active: string; fallback: string }>;
};

export type SystemOperationsSnapshot = {
  cronAvailable: boolean;
  cronJobs: CronJobStatus[];
  recentRetentionRuns: RetentionRunRow[];
  materializedViews: MaterializedViewStatus[];
  mvFreshness: MvFreshnessStatus[];
  queueStats: QueueStats;
  recentJobs: RecentJobRow[];
  activeWorkers: WorkerHeartbeatRow[];
  exportDurationSamples: ExportDurationSample[];
  workerRecovery24h: WorkerRecovery24h;
  operationalAlerts: OperationalAlertRow[];
  operationalTimeline: OperationalTimelineRow[];
  rateLimiterRuntime: RateLimiterRuntimeSnapshot;
  activeExportJobsCount: number;
  queueAnalyticsBrief: QueueAnalyticsBrief;
  openOperationalAlertsCount: number;
  jobsScopeOrganizationId: string | null;
  generatedAt: string;
};

export type SystemOperationsSnapshotResult =
  | SystemOperationsSnapshot
  | { error: string; errorKind?: "auth_required" | "permission_denied" | "fetch_error" };
