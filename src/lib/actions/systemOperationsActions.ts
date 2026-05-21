"use server";

/**
 * Faz 10.6 — Sistem operasyonları paneli için server action.
 *
 * Görünür hale getirir:
 *   - Retention pg_cron job'larının son çalışma durumu
 *   - MV (monthly_finance_summary) son refresh zamanı
 *   - Son N retention run özetleri
 *
 * Erişim: admin / super_admin (organization scope'undan bağımsız read-only sistem).
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { logger } from "@/lib/monitoring/logger";
import { isUuid } from "@/lib/validation/uuid";
import { trackQueueGrowth } from "@/lib/monitoring/runtime";
import { evaluateOperationalAlerts, type OperationalAlertFinding } from "@/lib/telemetry/alertRules";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRateLimiterRuntimeMetrics } from "@/lib/rateLimit/adapter";
import type {
  CronJobStatus,
  ExportDurationSample,
  MaterializedViewStatus,
  MvFreshnessStatus,
  OperationalAlertRow,
  OperationalTimelineRow,
  QueueAnalyticsBrief,
  QueueStats,
  RecentJobRow,
  RetentionRunRow,
  SystemOperationsSnapshot,
  WorkerHeartbeatRow,
  WorkerRecovery24h,
} from "@/lib/actions/systemOperationsTypes";

const WORKER_ACTIVE_WINDOW_MS = 5 * 60_000;
const MV_STALE_THRESHOLD_MIN = 60 * 24; // 24h
const MV_CRITICAL_THRESHOLD_MIN = 60 * 48; // 48h

function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * q));
  return sorted[idx];
}

function classifyMvStaleness(refreshedAt: string | null): MvFreshnessStatus["staleness"] {
  if (!refreshedAt) return "missing";
  const ts = Date.parse(refreshedAt);
  if (!Number.isFinite(ts)) return "missing";
  const ageMin = (Date.now() - ts) / 60_000;
  if (ageMin >= MV_CRITICAL_THRESHOLD_MIN) return "critical";
  if (ageMin >= MV_STALE_THRESHOLD_MIN) return "stale";
  return "fresh";
}

function computeAgeMinutes(refreshedAt: string | null): number | null {
  if (!refreshedAt) return null;
  const ts = Date.parse(refreshedAt);
  if (!Number.isFinite(ts)) return null;
  return Math.max(0, Math.floor((Date.now() - ts) / 60_000));
}

function buildQueueAnalyticsBrief(params: {
  recentJobs: RecentJobRow[];
  queueStats: QueueStats;
  exportDurationSamples: ExportDurationSample[];
  activeWorkers: WorkerHeartbeatRow[];
}): QueueAnalyticsBrief {
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const dayAgo = now - 24 * 60 * 60 * 1000;
  let jobsEnqueuedLast60Min = 0;
  let multiAttempt = 0;
  for (const j of params.recentJobs) {
    const enq = Date.parse(j.enqueuedAt);
    if (Number.isFinite(enq) && enq >= hourAgo) jobsEnqueuedLast60Min += 1;
    if ((j.attempts ?? 0) > 1) multiAttempt += 1;
  }
  const exportSamples24 = params.exportDurationSamples.filter((s) => {
    const t = Date.parse(s.finishedAt);
    return Number.isFinite(t) && t >= dayAgo;
  });
  const exportRowsLast24h = exportSamples24.reduce((acc, s) => acc + (s.rowCount ?? 0), 0);
  let exportRowsPerMinuteEstimate: number | null = null;
  if (exportSamples24.length > 0) {
    const fts = exportSamples24.map((s) => Date.parse(s.finishedAt)).filter((n) => Number.isFinite(n));
    if (fts.length > 0) {
      const spanMin = Math.max(1, (Math.max(...fts) - Math.min(...fts)) / 60_000);
      exportRowsPerMinuteEstimate = exportRowsLast24h / spanMin;
    }
  }
  return {
    jobsEnqueuedLast60Min,
    jobsPerMinuteEstimate: jobsEnqueuedLast60Min > 0 ? jobsEnqueuedLast60Min / 60 : null,
    multiAttemptFraction:
      params.recentJobs.length > 0 ? multiAttempt / params.recentJobs.length : null,
    dlqInSample: params.queueStats.deadLetterCount,
    avgExecutionMs: params.queueStats.averageDurationMs,
    p95ExecutionMs: params.queueStats.p95DurationMs,
    exportsFinishedLast24h: exportSamples24.length,
    exportRowsLast24h,
    exportRowsPerMinuteEstimate,
    workerPulseActive: params.activeWorkers.filter((w) => w.isActive).length,
    workerPulseTotal: params.activeWorkers.length,
  };
}

async function syncOperationalAlertsToDb(
  adminClient: SupabaseClient,
  findings: OperationalAlertFinding[]
): Promise<void> {
  const CRITICAL_REPEAT_COOLDOWN_MS = 30 * 60 * 1000;
  try {
    const findingKeys = new Set(findings.map((f) => f.ruleKey));
    const { data: openRows } = await adminClient
      .from("peaker_operational_alerts")
      .select("id, rule_key")
      .is("resolved_at", null);
    for (const row of openRows ?? []) {
      const rec = row as { id: string; rule_key: string };
      if (!findingKeys.has(rec.rule_key)) {
        await adminClient
          .from("peaker_operational_alerts")
          .update({ resolved_at: new Date().toISOString() })
          .eq("id", rec.id);
      }
    }
    for (const f of findings) {
      const { data: existing } = await adminClient
        .from("peaker_operational_alerts")
        .select("id, escalation_count, last_escalated_at, noise_suppressed")
        .eq("rule_key", f.ruleKey)
        .is("resolved_at", null)
        .maybeSingle();
      if (existing?.id) {
        const ex = existing as {
          id: string;
          escalation_count: number | null;
          last_escalated_at: string | null;
          noise_suppressed: boolean | null;
        };
        const nowIso = new Date().toISOString();
        const patch: Record<string, unknown> = {
          severity: f.severity,
          title: f.title,
          detail: f.detail,
          organization_id: f.organizationId,
        };
        if (f.severity === "critical") {
          const lastMs = ex.last_escalated_at ? Date.parse(ex.last_escalated_at) : NaN;
          const cooled =
            !Number.isFinite(lastMs) || Date.now() - lastMs > CRITICAL_REPEAT_COOLDOWN_MS;
          if (cooled) {
            patch.escalation_count = Math.max(0, Number(ex.escalation_count ?? 0)) + 1;
            patch.last_escalated_at = nowIso;
            patch.noise_suppressed = false;
          } else {
            patch.noise_suppressed = true;
          }
        } else {
          patch.noise_suppressed = false;
        }
        await adminClient.from("peaker_operational_alerts").update(patch).eq("id", ex.id);
      } else {
        await adminClient.from("peaker_operational_alerts").insert({
          rule_key: f.ruleKey,
          severity: f.severity,
          title: f.title,
          detail: f.detail,
          organization_id: f.organizationId,
        });
      }
    }
  } catch (e) {
    logger.warn("sistem_operasyonlari", "operational alerts sync failed", {
      reason: (e as Error).message,
    });
  }
}

export async function getSystemOperationsSnapshot(options?: {
  /** super_admin: job / timeline daraltması (UUID). */
  scopeOrganizationId?: string | null;
}): Promise<
  SystemOperationsSnapshot | { error: string; errorKind?: "auth_required" | "permission_denied" | "fetch_error" }
> {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: false });
  if ("error" in resolved) return { error: resolved.error, errorKind: "auth_required" };
  const role = getSafeRole(resolved.actor.role);
  if (role !== "admin" && role !== "super_admin") {
    return { error: "Bu paneli görüntüleme yetkiniz yok.", errorKind: "permission_denied" };
  }

  const jobsScopeOrganizationId =
    role === "super_admin"
      ? options?.scopeOrganizationId && isUuid(options.scopeOrganizationId)
        ? options.scopeOrganizationId
        : null
      : resolved.actor.organizationId;

  const adminClient = createSupabaseAdminClient();

  // 1) cron job'ların var olup olmadığını sorgula.
  let cronAvailable = false;
  const cronJobs: CronJobStatus[] = [];
  try {
    const { data: cronRows, error: cronErr } = await adminClient
      .schema("cron")
      .from("job")
      .select("jobname, schedule, active")
      .in("jobname", [
        "peaker_retention_notifications",
        "peaker_retention_audit_logs",
        "peaker_mv_monthly_finance_summary",
        "peaker_jobs_retention",
        "peaker_daily_training_load_mv_refresh",
        "peaker_worker_tick",
        "peaker_rate_limit_cleanup",
      ]);
    if (cronErr) {
      // pg_cron extension yok ya da cron schema'sına erişim kapalı.
      logger.info("sistem_operasyonlari", "cron schema erişilemedi", { reason: cronErr.message });
    } else if (cronRows) {
      cronAvailable = true;
      for (const row of cronRows as Array<{ jobname: string; schedule: string | null; active: boolean | null }>) {
        cronJobs.push({
          jobname: row.jobname,
          schedule: row.schedule ?? null,
          active: row.active ?? null,
        });
      }
    }
  } catch (e) {
    logger.warn("sistem_operasyonlari", "cron job query exception", { error: (e as Error).message });
  }

  // 2) Son retention çalıştırmalarını al (peaker_retention_cron_health view).
  const recentRetentionRuns: RetentionRunRow[] = [];
  try {
    const { data: runs, error: runsErr } = await adminClient
      .from("peaker_retention_cron_health")
      .select("jobname, start_time, end_time, status, return_message, duration_ms")
      .order("start_time", { ascending: false })
      .limit(20);
    if (runsErr) {
      logger.info("sistem_operasyonlari", "retention health view erişilemedi", { reason: runsErr.message });
    } else if (runs) {
      for (const row of runs as Array<{
        jobname: string;
        start_time: string;
        end_time: string | null;
        status: string;
        return_message: string | null;
        duration_ms: number | null;
      }>) {
        recentRetentionRuns.push({
          jobname: row.jobname,
          startTime: row.start_time,
          endTime: row.end_time,
          status: row.status,
          returnMessage: row.return_message,
          durationMs: row.duration_ms,
        });
      }
    }
  } catch (e) {
    logger.warn("sistem_operasyonlari", "retention health view exception", { error: (e as Error).message });
  }

  // 3) MV durumu — monthly_finance_summary + daily_training_load_aggregates.
  const materializedViews: MaterializedViewStatus[] = [];

  async function probeMv(name: string): Promise<MaterializedViewStatus> {
    try {
      const { data, error } = await adminClient
        .from(name)
        .select("refreshed_at", { count: "exact" })
        .limit(1);
      if (error) {
        return { name, available: false, reason: error.message };
      }
      const first = (data ?? [])[0] as { refreshed_at?: string | null } | undefined;
      return { name, refreshedAt: first?.refreshed_at ?? null, available: true };
    } catch (e) {
      return { name, available: false, reason: (e as Error).message };
    }
  }

  materializedViews.push(await probeMv("monthly_finance_summary"));
  materializedViews.push(await probeMv("daily_training_load_aggregates"));

  // 4) Cron job'ların son run özetlerini retentionRuns ile zenginleştir.
  for (const job of cronJobs) {
    const matching = recentRetentionRuns.find((r) => r.jobname === job.jobname);
    if (matching) {
      job.lastRunStatus = matching.status;
      job.lastRunStartedAt = matching.startTime;
      job.lastRunDurationMs = matching.durationMs;
      job.lastRunMessage = matching.returnMessage;
    }
  }

  // Faz 11.8 + Faz 12.8 — Queue stats + recent jobs (tenant-scoped).
  const queueStats: QueueStats = {
    available: false,
    total: 0,
    byStatus: {},
    failedRecentCount: 0,
    oldestQueuedAt: null,
    deadLetterCount: 0,
    averageDurationMs: null,
    p95DurationMs: null,
  };
  const recentJobs: RecentJobRow[] = [];
  const exportDurationSamples: ExportDurationSample[] = [];
  try {
    const orgFilter = role === "admin" ? resolved.actor.organizationId : jobsScopeOrganizationId;
    if (role === "admin" && !orgFilter) {
      queueStats.available = true;
      queueStats.reason = "Profilinize organizasyon atanmamış; job listesi boş.";
    } else {
      let jobsQuery = adminClient
        .from("peaker_jobs_log")
        .select(
          "id, organization_id, job_kind, status, attempts, max_attempts, enqueued_at, started_at, finished_at, error_kind, error_message, result"
        )
        .order("enqueued_at", { ascending: false })
        .limit(100);
      if (orgFilter) {
        jobsQuery = jobsQuery.eq("organization_id", orgFilter);
      }
      const { data: jobsRows, error: jobsErr } = await jobsQuery;
      if (jobsErr) {
        queueStats.reason = jobsErr.message;
      } else if (jobsRows) {
        queueStats.available = true;
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        let oldestQueuedAt: string | null = null;
        const durationsMs: number[] = [];
        for (const row of jobsRows as Array<{
          id: string;
          organization_id: string | null;
          job_kind: string;
          status: string;
          attempts: number;
          max_attempts: number;
          enqueued_at: string;
          started_at: string | null;
          finished_at: string | null;
          error_kind: string | null;
          error_message: string | null;
          result: Record<string, unknown> | null;
        }>) {
          recentJobs.push({
            id: row.id,
            organizationId: row.organization_id,
            kind: row.job_kind,
            status: row.status,
            attempts: row.attempts ?? 0,
            maxAttempts: row.max_attempts ?? 5,
            enqueuedAt: row.enqueued_at,
            startedAt: row.started_at,
            finishedAt: row.finished_at,
            errorKind: row.error_kind,
            errorMessage: row.error_message,
          });
          queueStats.byStatus[row.status] = (queueStats.byStatus[row.status] || 0) + 1;
          queueStats.total += 1;
          if (row.status === "failed" && row.enqueued_at >= since) {
            queueStats.failedRecentCount += 1;
          }
          if (row.status === "dead_letter") {
            queueStats.deadLetterCount += 1;
          }
          if (row.status === "queued" && (!oldestQueuedAt || row.enqueued_at < oldestQueuedAt)) {
            oldestQueuedAt = row.enqueued_at;
          }
          if (row.status === "succeeded" && row.started_at && row.finished_at) {
            const dur = Date.parse(row.finished_at) - Date.parse(row.started_at);
            if (Number.isFinite(dur) && dur >= 0) durationsMs.push(dur);
          }
          if (
            row.status === "succeeded" &&
            row.finished_at &&
            row.job_kind.startsWith("export.")
          ) {
            const result = row.result ?? {};
            const dRaw = (result as Record<string, unknown>).durationMs;
            const rcRaw = (result as Record<string, unknown>).rowCount;
            const trRaw = (result as Record<string, unknown>).truncated;
            const dMs = typeof dRaw === "number" && Number.isFinite(dRaw) ? dRaw : null;
            const rc =
              typeof rcRaw === "number" && Number.isFinite(rcRaw)
                ? Math.max(0, Math.floor(rcRaw))
                : null;
            if (dMs !== null) {
              exportDurationSamples.push({
                finishedAt: row.finished_at,
                kind: row.job_kind,
                durationMs: dMs,
                rowCount: rc,
                truncated: Boolean(trRaw),
              });
            }
          }
        }
        queueStats.oldestQueuedAt = oldestQueuedAt;
        if (durationsMs.length > 0) {
          const sum = durationsMs.reduce((a, b) => a + b, 0);
          queueStats.averageDurationMs = Math.round(sum / durationsMs.length);
          const sorted = [...durationsMs].sort((a, b) => a - b);
          queueStats.p95DurationMs = quantile(sorted, 0.95);
        }
      }
    }
  } catch (e) {
    queueStats.reason = (e as Error).message;
  }

  // Faz 12.8 — Active worker heartbeats (son 60 dakika, worker başına son tick).
  const activeWorkers: WorkerHeartbeatRow[] = [];
  try {
    const since = new Date(Date.now() - 60 * 60_000).toISOString();
    const { data: heartbeats, error: hbErr } = await adminClient
      .from("peaker_worker_heartbeat")
      .select(
        "worker_id, source, ticked_at, processed_count, succeeded_count, failed_count, dead_letter_count, duration_ms, rescue_rescued_count, rescue_dead_stuck_count, retry_storm_detected"
      )
      .gte("ticked_at", since)
      .order("ticked_at", { ascending: false })
      .limit(120);
    if (!hbErr && Array.isArray(heartbeats)) {
      const seen = new Set<string>();
      for (const row of heartbeats as Array<{
        worker_id: string;
        source: string;
        ticked_at: string;
        processed_count: number | null;
        succeeded_count: number | null;
        failed_count: number | null;
        dead_letter_count: number | null;
        duration_ms: number | null;
        rescue_rescued_count?: number | null;
        rescue_dead_stuck_count?: number | null;
        retry_storm_detected?: boolean | null;
      }>) {
        if (seen.has(row.worker_id)) continue;
        seen.add(row.worker_id);
        const lastTickMs = Date.parse(row.ticked_at);
        const isActive =
          Number.isFinite(lastTickMs) && Date.now() - lastTickMs <= WORKER_ACTIVE_WINDOW_MS;
        activeWorkers.push({
          workerId: row.worker_id,
          source: row.source,
          lastTickAt: row.ticked_at,
          processedCount: row.processed_count ?? 0,
          succeededCount: row.succeeded_count ?? 0,
          failedCount: row.failed_count ?? 0,
          deadLetterCount: row.dead_letter_count ?? 0,
          durationMs: row.duration_ms ?? 0,
          isActive,
          rescueRescuedCount: row.rescue_rescued_count ?? 0,
          rescueDeadStuckCount: row.rescue_dead_stuck_count ?? 0,
          retryStormDetected: Boolean(row.retry_storm_detected),
        });
      }
    }
  } catch (e) {
    logger.warn("sistem_operasyonlari", "worker heartbeat fetch failed", {
      reason: (e as Error).message,
    });
  }

  const workerRecovery24h: WorkerRecovery24h = { rescuedJobs: 0, deadJobs: 0, retryStorms: 0 };
  try {
    const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: hb24 } = await adminClient
      .from("peaker_worker_heartbeat")
      .select("rescue_rescued_count, rescue_dead_stuck_count, retry_storm_detected")
      .gte("ticked_at", since24);
    for (const row of hb24 ?? []) {
      const r = row as {
        rescue_rescued_count?: number | null;
        rescue_dead_stuck_count?: number | null;
        retry_storm_detected?: boolean | null;
      };
      workerRecovery24h.rescuedJobs += Number(r.rescue_rescued_count ?? 0);
      workerRecovery24h.deadJobs += Number(r.rescue_dead_stuck_count ?? 0);
      if (r.retry_storm_detected) workerRecovery24h.retryStorms += 1;
    }
  } catch (e) {
    logger.warn("sistem_operasyonlari", "worker 24h recovery aggregate failed", {
      reason: (e as Error).message,
    });
  }

  // Faz 12.8 + Faz 13.4 — MV freshness.
  const mvFreshness: MvFreshnessStatus[] = materializedViews.map((mv) => {
    const ageMin = mv.available ? computeAgeMinutes(mv.refreshedAt ?? null) : null;
    const staleness = mv.available ? classifyMvStaleness(mv.refreshedAt ?? null) : "missing";
    return {
      name: mv.name,
      refreshedAt: mv.refreshedAt ?? null,
      ageMinutes: ageMin,
      staleDurationSeconds: ageMin != null ? ageMin * 60 : null,
      refreshDurationMs: null,
      staleness,
    };
  });

  let oldestQueuedAgeMinutes: number | null = null;
  if (queueStats.oldestQueuedAt) {
    const t = Date.parse(queueStats.oldestQueuedAt);
    if (Number.isFinite(t)) {
      oldestQueuedAgeMinutes = Math.max(0, Math.floor((Date.now() - t) / 60_000));
    }
  }
  const exportDurationsSorted = exportDurationSamples
    .map((s) => s.durationMs)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  const exportDurationP95Ms =
    exportDurationsSorted.length > 0 ? quantile(exportDurationsSorted, 0.95) : null;
  const mvCriticalNames = mvFreshness.filter((m) => m.staleness === "critical").map((m) => m.name);
  const mvStaleNames = mvFreshness.filter((m) => m.staleness === "stale").map((m) => m.name);

  const activeExportJobsCount = recentJobs.filter(
    (j) =>
      (j.status === "queued" || j.status === "running") && (j.kind || "").startsWith("export.")
  ).length;

  const jobsLast60Min = recentJobs.filter((j) => {
    const t = Date.parse(j.enqueuedAt);
    return Number.isFinite(t) && Date.now() - t < 60 * 60 * 1000;
  }).length;

  let workerHeartbeatStaleMinutes: number | null = null;
  if (activeWorkers.length > 0) {
    const ticks = activeWorkers
      .map((w) => Date.parse(w.lastTickAt))
      .filter((t): t is number => Number.isFinite(t));
    if (ticks.length > 0) {
      workerHeartbeatStaleMinutes = Math.floor((Date.now() - Math.max(...ticks)) / 60_000);
    }
  }

  const cronFailedJobNames = cronJobs
    .filter((j) => (j.lastRunStatus || "").toLowerCase() === "failed")
    .map((j) => j.jobname);

  trackQueueGrowth({
    jobsLast60Min,
    queuedTotal: Number(queueStats.byStatus.queued ?? 0),
    dlqCount: queueStats.deadLetterCount,
  });

  const alertFindings = evaluateOperationalAlerts({
    oldestQueuedAgeMinutes,
    deadLetterSampleCount: queueStats.deadLetterCount,
    exportDurationP95Ms,
    mvCriticalNames,
    mvStaleNames,
    workerRescued24h: workerRecovery24h.rescuedJobs,
    workerDeadStuck24h: workerRecovery24h.deadJobs,
    workerRetryStorms24h: workerRecovery24h.retryStorms,
    workerHeartbeatStaleMinutes,
    cronFailedJobNames,
    queueJobsLast60Min: jobsLast60Min,
    activeExportJobsCount,
  });
  await syncOperationalAlertsToDb(adminClient, alertFindings);

  const operationalAlerts: OperationalAlertRow[] = [];
  try {
    let aq = adminClient
      .from("peaker_operational_alerts")
      .select(
        "id, rule_key, severity, title, detail, organization_id, created_at, resolved_at, acknowledged_at, acknowledged_by, escalation_count, last_escalated_at, noise_suppressed"
      )
      .order("resolved_at", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: false })
      .limit(60);
    if (role === "admin" && resolved.actor.organizationId) {
      aq = aq.or(
        `organization_id.is.null,organization_id.eq.${resolved.actor.organizationId}`
      );
    }
    const { data: alertRows, error: aErr } = await aq;
    if (!aErr && alertRows) {
      for (const row of alertRows as Array<{
        id: string;
        rule_key: string;
        severity: string;
        title: string;
        detail: Record<string, unknown> | null;
        organization_id: string | null;
        created_at: string;
        resolved_at: string | null;
        acknowledged_at: string | null;
        acknowledged_by: string | null;
        escalation_count: number | null;
        last_escalated_at: string | null;
        noise_suppressed: boolean | null;
      }>) {
        operationalAlerts.push({
          id: row.id,
          ruleKey: row.rule_key,
          severity: row.severity as OperationalAlertRow["severity"],
          title: row.title,
          detail: row.detail ?? {},
          organizationId: row.organization_id,
          createdAt: row.created_at,
          resolvedAt: row.resolved_at,
          acknowledgedAt: row.acknowledged_at,
          acknowledgedBy: row.acknowledged_by,
          escalationCount: Math.max(0, Number(row.escalation_count ?? 0)),
          lastEscalatedAt: row.last_escalated_at,
          noiseSuppressed: Boolean(row.noise_suppressed),
        });
      }
    }
  } catch (e) {
    logger.warn("sistem_operasyonlari", "operational alerts fetch failed", {
      reason: (e as Error).message,
    });
  }

  const openOperationalAlertsCount = operationalAlerts.filter((a) => !a.resolvedAt).length;
  const queueAnalyticsBrief = buildQueueAnalyticsBrief({
    recentJobs,
    queueStats,
    exportDurationSamples,
    activeWorkers,
  });
  const rateLimiterRuntime = getRateLimiterRuntimeMetrics();

  const operationalTimeline: OperationalTimelineRow[] = [];
  try {
    let tq = adminClient
      .from("peaker_operational_timeline")
      .select("id, event_type, severity, summary, organization_id, created_at, payload")
      .order("created_at", { ascending: false })
      .limit(100);
    if (role === "admin" && resolved.actor.organizationId) {
      tq = tq.or(`organization_id.is.null,organization_id.eq.${resolved.actor.organizationId}`);
    }
    const { data: tlRows, error: tlErr } = await tq;
    if (!tlErr && tlRows) {
      for (const row of tlRows as Array<{
        id: string;
        event_type: string;
        severity: string;
        summary: string;
        organization_id: string | null;
        created_at: string;
        payload: Record<string, unknown> | null;
      }>) {
        operationalTimeline.push({
          id: row.id,
          eventType: row.event_type,
          severity: row.severity as OperationalTimelineRow["severity"],
          summary: row.summary,
          organizationId: row.organization_id,
          createdAt: row.created_at,
          payload: row.payload ?? {},
        });
      }
    }
  } catch (e) {
    logger.warn("sistem_operasyonlari", "operational timeline fetch failed", {
      reason: (e as Error).message,
    });
  }

  return {
    cronAvailable,
    cronJobs,
    recentRetentionRuns,
    materializedViews,
    mvFreshness,
    queueStats,
    recentJobs,
    activeWorkers,
    exportDurationSamples: exportDurationSamples.slice(0, 30),
    workerRecovery24h,
    operationalAlerts,
    operationalTimeline,
    rateLimiterRuntime,
    activeExportJobsCount,
    queueAnalyticsBrief,
    openOperationalAlertsCount,
    jobsScopeOrganizationId,
    generatedAt: new Date().toISOString(),
  };
}
