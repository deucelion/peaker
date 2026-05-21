/**
 * FAZ 27 — Aggregate health scores (0–100) for ops dashboard.
 */

import type { SystemOperationsSnapshot } from "@/lib/actions/systemOperationsTypes";
import type { ClientRealtimeCounters } from "@/lib/realtime/clientRealtimeStats";

export type HealthScoreBundle = {
  overall: number;
  queue: number;
  worker: number;
  realtime: number;
  exports: number;
  schema: number;
  label: "healthy" | "degraded" | "critical";
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function scoreClientRealtimeHealth(stats: ClientRealtimeCounters): number {
  let score = 100;
  if (stats.reconnectNoted > 5) score -= 15;
  if (stats.reconnectNoted > 15) score -= 25;
  if (stats.failedSubscription > 3) score -= 20;
  if (stats.duplicateListenersPrevented > 10) score -= 10;
  return clamp(score);
}

export function computeProductionHealthScores(
  snapshot: SystemOperationsSnapshot,
  clientRealtime?: ClientRealtimeCounters | null
): HealthScoreBundle {
  const criticalAlerts = snapshot.operationalAlerts.filter(
    (a) => !a.resolvedAt && a.severity === "critical"
  ).length;
  const warningAlerts = snapshot.operationalAlerts.filter(
    (a) => !a.resolvedAt && a.severity === "warning"
  ).length;

  let queue = 100;
  const queued = Number(snapshot.queueStats.byStatus.queued ?? 0);
  if (queued > 20) queue -= 15;
  if (queued > 80) queue -= 25;
  if (snapshot.queueStats.deadLetterCount > 5) queue -= 20;
  if (snapshot.queueStats.deadLetterCount > 20) queue -= 30;
  queue = clamp(queue);

  const active = snapshot.queueAnalyticsBrief.workerPulseActive;
  const total = Math.max(1, snapshot.queueAnalyticsBrief.workerPulseTotal);
  let worker = clamp((active / total) * 100);
  if (snapshot.workerRecovery24h.retryStorms > 3) worker -= 15;
  if (snapshot.workerRecovery24h.deadJobs > 5) worker -= 20;

  let exports = 100;
  const p95 = snapshot.exportDurationSamples
    .map((s) => s.durationMs)
    .sort((a, b) => a - b);
  const p95val = p95.length > 0 ? p95[Math.floor(p95.length * 0.95)] ?? 0 : 0;
  if (p95val > 8_000) exports -= 20;
  if (p95val > 20_000) exports -= 40;
  if (snapshot.activeExportJobsCount > 3) exports -= 15;
  exports = clamp(exports);

  const mvBad = snapshot.mvFreshness.filter(
    (m) => m.staleness === "critical" || m.staleness === "missing"
  ).length;
  let schema = mvBad > 0 ? 60 : 95;
  if (!snapshot.cronAvailable) schema -= 20;
  schema = clamp(schema);

  const realtime = clientRealtime ? scoreClientRealtimeHealth(clientRealtime) : 85;

  let overall =
    queue * 0.25 + worker * 0.25 + exports * 0.15 + schema * 0.15 + realtime * 0.1;
  overall -= criticalAlerts * 12;
  overall -= warningAlerts * 4;
  overall = clamp(overall);

  const label: HealthScoreBundle["label"] =
    overall >= 75 && criticalAlerts === 0 ? "healthy" : overall >= 50 ? "degraded" : "critical";

  return { overall, queue, worker, realtime, exports, schema, label };
}
