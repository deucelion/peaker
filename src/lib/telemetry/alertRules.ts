/**
 * Faz 13.3 — Operational alert rule engine (threshold → severity).
 * Persist katmanı `systemOperationsActions` içinde best-effort upsert.
 */

export type AlertSeverity = "info" | "warning" | "critical";

export type OperationalAlertFinding = {
  ruleKey: string;
  organizationId: string | null;
  severity: AlertSeverity;
  title: string;
  detail: Record<string, unknown>;
};

export type OperationalAlertMetrics = {
  /** En eski queued job yaşı (dakika); yoksa null */
  oldestQueuedAgeMinutes: number | null;
  /** Son snapshot’taki DLQ (dead_letter) sayısı (örnek penceresi) */
  deadLetterSampleCount: number;
  /** Export örnekleri üzerinden p95 süre (ms) */
  exportDurationP95Ms: number | null;
  /** MV freshness: kritik / stale isimleri */
  mvCriticalNames: string[];
  mvStaleNames: string[];
  /** Son 24h heartbeat toplamları */
  workerRescued24h: number;
  workerDeadStuck24h: number;
  workerRetryStorms24h: number;
  /** Son worker tick yaşı (dakika); null = bilinmiyor */
  workerHeartbeatStaleMinutes: number | null;
  /** pg_cron / retention job son çalışma failed */
  cronFailedJobNames: string[];
  /** Son 60 dk enqueue */
  queueJobsLast60Min: number;
  /** Aktif export job sayısı */
  activeExportJobsCount: number;
};

const QUEUE_LATENCY_WARN_MIN = 15;
const QUEUE_LATENCY_CRITICAL_MIN = 60;

const DLQ_WARN = 5;
const DLQ_CRITICAL = 15;

const EXPORT_P95_WARN_MS = 8_000;
const EXPORT_P95_CRITICAL_MS = 20_000;

const RESCUE_WARN = 1;
const RESCUE_CRITICAL = 10;

const DEAD_STUCK_WARN = 1;
const DEAD_STUCK_CRITICAL = 5;

const RETRY_STORM_WARN = 1;
const RETRY_STORM_CRITICAL = 5;

function push(
  out: OperationalAlertFinding[],
  finding: Omit<OperationalAlertFinding, "ruleKey"> & { ruleKey: string }
) {
  out.push(finding);
}

/**
 * Metrik girdisinden uyarı listesi üretir (idempotent, saf fonksiyon).
 */
export function evaluateOperationalAlerts(metrics: OperationalAlertMetrics): OperationalAlertFinding[] {
  const out: OperationalAlertFinding[] = [];

  if (metrics.oldestQueuedAgeMinutes != null) {
    if (metrics.oldestQueuedAgeMinutes >= QUEUE_LATENCY_CRITICAL_MIN) {
      push(out, {
        ruleKey: "queue:latency_oldest_queued",
        organizationId: null,
        severity: "critical",
        title: "Kuyruk gecikmesi (kritik)",
        detail: { oldestQueuedAgeMinutes: metrics.oldestQueuedAgeMinutes, thresholdMin: QUEUE_LATENCY_CRITICAL_MIN },
      });
    } else if (metrics.oldestQueuedAgeMinutes >= QUEUE_LATENCY_WARN_MIN) {
      push(out, {
        ruleKey: "queue:latency_oldest_queued",
        organizationId: null,
        severity: "warning",
        title: "Kuyruk gecikmesi",
        detail: { oldestQueuedAgeMinutes: metrics.oldestQueuedAgeMinutes, thresholdMin: QUEUE_LATENCY_WARN_MIN },
      });
    }
  }

  if (metrics.deadLetterSampleCount >= DLQ_CRITICAL) {
    push(out, {
      ruleKey: "queue:dlq_growth_sample",
      organizationId: null,
      severity: "critical",
      title: "DLQ örnek seti yüksek",
      detail: { deadLetterSampleCount: metrics.deadLetterSampleCount, threshold: DLQ_CRITICAL },
    });
  } else if (metrics.deadLetterSampleCount >= DLQ_WARN) {
    push(out, {
      ruleKey: "queue:dlq_growth_sample",
      organizationId: null,
      severity: "warning",
      title: "DLQ birikimi",
      detail: { deadLetterSampleCount: metrics.deadLetterSampleCount, threshold: DLQ_WARN },
    });
  }

  if (metrics.exportDurationP95Ms != null) {
    if (metrics.exportDurationP95Ms >= EXPORT_P95_CRITICAL_MS) {
      push(out, {
        ruleKey: "export:duration_p95",
        organizationId: null,
        severity: "critical",
        title: "Export süresi kritik (p95)",
        detail: { exportDurationP95Ms: metrics.exportDurationP95Ms, thresholdMs: EXPORT_P95_CRITICAL_MS },
      });
    } else if (metrics.exportDurationP95Ms >= EXPORT_P95_WARN_MS) {
      push(out, {
        ruleKey: "export:duration_p95",
        organizationId: null,
        severity: "warning",
        title: "Export süresi yüksek (p95)",
        detail: { exportDurationP95Ms: metrics.exportDurationP95Ms, thresholdMs: EXPORT_P95_WARN_MS },
      });
    }
  }

  for (const name of metrics.mvCriticalNames) {
    push(out, {
      ruleKey: `mv:stale_critical:${name}`,
      organizationId: null,
      severity: "critical",
      title: `MV freshness kritik: ${name}`,
      detail: { mvName: name },
    });
  }
  for (const name of metrics.mvStaleNames) {
    if (metrics.mvCriticalNames.includes(name)) continue;
    push(out, {
      ruleKey: `mv:stale_warning:${name}`,
      organizationId: null,
      severity: "warning",
      title: `MV freshness uyarı: ${name}`,
      detail: { mvName: name },
    });
  }

  if (metrics.workerDeadStuck24h >= DEAD_STUCK_CRITICAL) {
    push(out, {
      ruleKey: "worker:dead_stuck_24h",
      organizationId: null,
      severity: "critical",
      title: "Stuck job finalize (DLQ) yüksek",
      detail: { workerDeadStuck24h: metrics.workerDeadStuck24h, threshold: DEAD_STUCK_CRITICAL },
    });
  } else if (metrics.workerDeadStuck24h >= DEAD_STUCK_WARN) {
    push(out, {
      ruleKey: "worker:dead_stuck_24h",
      organizationId: null,
      severity: "warning",
      title: "Stuck job finalize (DLQ)",
      detail: { workerDeadStuck24h: metrics.workerDeadStuck24h, threshold: DEAD_STUCK_WARN },
    });
  }

  if (metrics.workerRescued24h >= RESCUE_CRITICAL) {
    push(out, {
      ruleKey: "worker:rescued_24h",
      organizationId: null,
      severity: "critical",
      title: "Stuck rescue hacmi olağanüstü",
      detail: { workerRescued24h: metrics.workerRescued24h, threshold: RESCUE_CRITICAL },
    });
  } else if (metrics.workerRescued24h >= RESCUE_WARN) {
    push(out, {
      ruleKey: "worker:rescued_24h",
      organizationId: null,
      severity: "warning",
      title: "Stuck job rescue devreye girdi",
      detail: { workerRescued24h: metrics.workerRescued24h, threshold: RESCUE_WARN },
    });
  }

  if (metrics.workerRetryStorms24h >= RETRY_STORM_CRITICAL) {
    push(out, {
      ruleKey: "worker:retry_storm_24h",
      organizationId: null,
      severity: "critical",
      title: "Retry storm sıklığı kritik",
      detail: { workerRetryStorms24h: metrics.workerRetryStorms24h, threshold: RETRY_STORM_CRITICAL },
    });
  } else if (metrics.workerRetryStorms24h >= RETRY_STORM_WARN) {
    push(out, {
      ruleKey: "worker:retry_storm_24h",
      organizationId: null,
      severity: "warning",
      title: "Retry storm tespitleri",
      detail: { workerRetryStorms24h: metrics.workerRetryStorms24h, threshold: RETRY_STORM_WARN },
    });
  }

  if (metrics.workerHeartbeatStaleMinutes != null && metrics.workerHeartbeatStaleMinutes >= 5) {
    push(out, {
      ruleKey: "worker:heartbeat_stale",
      organizationId: null,
      severity: metrics.workerHeartbeatStaleMinutes >= 15 ? "critical" : "warning",
      title: "Worker nabzı gecikmiş",
      detail: { staleMinutes: metrics.workerHeartbeatStaleMinutes },
    });
  }

  for (const name of metrics.cronFailedJobNames) {
    push(out, {
      ruleKey: `cron:failed:${name}`,
      organizationId: null,
      severity: "warning",
      title: `Cron başarısız: ${name}`,
      detail: { jobName: name },
    });
  }

  if (metrics.queueJobsLast60Min >= 150) {
    push(out, {
      ruleKey: "queue:enqueue_spike_60m",
      organizationId: null,
      severity: metrics.queueJobsLast60Min >= 300 ? "critical" : "warning",
      title: "Kuyruk büyüme hızı yüksek",
      detail: { jobsLast60Min: metrics.queueJobsLast60Min },
    });
  }

  if (metrics.activeExportJobsCount >= 4) {
    push(out, {
      ruleKey: "export:concurrent_active",
      organizationId: null,
      severity: metrics.activeExportJobsCount >= 8 ? "critical" : "warning",
      title: "Eşzamanlı export yükü",
      detail: { activeExportJobsCount: metrics.activeExportJobsCount },
    });
  }

  return out;
}
