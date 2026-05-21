"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshCcw,
  ServerCog,
  Database,
  Clock,
  ShieldCheck,
  Loader2,
  Activity,
  Cpu,
  TrendingUp,
  AlertTriangle,
  Skull,
  History,
  ListFilter,
  RotateCcw,
  X,
  Radio,
  Gauge,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import Notification from "@/components/Notification";
import EmptyState from "@/components/ui/EmptyState";
import { InlineErrorState } from "@/components/ui/data-display";
import { useMountedRef } from "@/lib/hooks/useMountedRef";
import { queryErrorCopy } from "@/lib/ui/queryState";
import { ChartFrame, chartTooltipStyle } from "@/components/ui/charts";
import { LiveConnectionStrip, type LiveStatusTone } from "@/components/realtime/LiveStatusPrimitives";
import { getSystemOperationsSnapshot } from "@/lib/actions/systemOperationsActions";
import type { SystemOperationsSnapshot } from "@/lib/actions/systemOperationsTypes";
import { getSchemaHealthSnapshotForOps } from "@/lib/actions/schemaHealthActions";
import type { SchemaHealthSnapshot } from "@/lib/actions/schemaHealthActions";
import { getClientRealtimeStatsSnapshot } from "@/lib/realtime/clientRealtimeStats";
import { formatRelativeTimeTr } from "@/lib/realtime/formatRelativeTimeTr";
import { fetchMeRoleClient } from "@/lib/auth/meRoleClient";
import {
  queueAdminRetrySingleJob,
  queueAdminRetryAllRetryable,
  queueAdminDlqRequeue,
  queueAdminCancelQueuedJob,
  queueAdminPurgeCompleted,
} from "@/lib/actions/queueAdminActions";
import {
  acknowledgeOperationalAlert,
  resolveOperationalAlert,
} from "@/lib/actions/operationalAlertActions";
import {
  replayOperationalAlertEvaluation,
  replayEnqueueAuditExport,
  replayEnqueueRetentionAudit,
} from "@/lib/actions/operationalReplayActions";
import { ProductionHealthOverview } from "@/components/ops/ProductionHealthOverview";

/**
 * Faz 10.6 — Sistem Operasyonları Paneli.
 *
 * Admin / super_admin için:
 *   - pg_cron job durumu (retention + MV refresh)
 *   - Son retention çalıştırmaları (peaker_retention_cron_health view)
 *   - Materialized view durumu (monthly_finance_summary refreshed_at)
 *
 * UI: read-only diagnostic. Refresh butonu manuel tekrar fetch eder.
 */

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function statusToneClass(status: string | null | undefined): string {
  const s = (status || "").toLowerCase();
  if (s === "succeeded") return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
  if (s === "failed") return "text-red-400 border-red-500/30 bg-red-500/10";
  if (s === "dead_letter") return "text-red-400 border-red-500/30 bg-red-500/10";
  if (s === "cancelled") return "text-gray-400 border-white/10 bg-white/5";
  if (s === "queued") return "text-sky-300 border-sky-500/30 bg-sky-500/10";
  return "text-gray-400 border-white/10 bg-white/5";
}

function mvStalenessToneClass(staleness: string): string {
  if (staleness === "fresh") return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
  if (staleness === "stale") return "text-amber-400 border-amber-500/30 bg-amber-500/10";
  if (staleness === "critical") return "text-red-400 border-red-500/30 bg-red-500/10";
  return "text-gray-400 border-white/10 bg-white/5";
}

function mvStalenessLabel(staleness: string): string {
  if (staleness === "fresh") return "Taze";
  if (staleness === "stale") return "Eski (>24sa)";
  if (staleness === "critical") return "Kritik (>48sa)";
  return "Yok";
}

function alertSeverityClass(sev: string): string {
  if (sev === "critical") return "text-red-400 border-red-500/30 bg-red-500/10";
  if (sev === "warning") return "text-amber-400 border-amber-500/30 bg-amber-500/10";
  return "text-sky-300 border-sky-500/30 bg-sky-500/10";
}

function resolveBulkOrganizationId(
  snapshot: SystemOperationsSnapshot,
  isSuperAdmin: boolean,
  orgScopeInput: string
): string | null {
  if (isSuperAdmin) return orgScopeInput.trim() || snapshot.jobsScopeOrganizationId;
  return snapshot.jobsScopeOrganizationId;
}

function ExportDurationSparkline({
  samples,
}: {
  samples: SystemOperationsSnapshot["exportDurationSamples"];
}) {
  // Faz 12.8 — Mini bar chart: son 30 export. Hızlı görsel anomali tespiti.
  if (samples.length === 0) return null;
  const max = Math.max(...samples.map((s) => s.durationMs), 1);
  return (
    <div className="mt-3 flex items-end gap-1 h-16">
      {samples
        .slice()
        .reverse()
        .map((s, idx) => {
          const ratio = Math.max(0.04, s.durationMs / max);
          const tone =
            s.durationMs >= 20_000
              ? "bg-red-500/70"
              : s.durationMs >= 5_000
                ? "bg-amber-400/70"
                : "bg-emerald-400/70";
          return (
            <div
              key={`${s.finishedAt}-${idx}`}
              title={`${s.kind} · ${s.durationMs} ms · ${s.rowCount ?? "?"} satır${s.truncated ? " · trunc" : ""}`}
              className={`w-2 rounded-sm ${tone}`}
              style={{ height: `${Math.round(ratio * 100)}%` }}
            />
          );
        })}
    </div>
  );
}

type RecentJobRow = SystemOperationsSnapshot["recentJobs"][number];

export default function SystemOperationsPage() {
  const [snapshot, setSnapshot] = useState<SystemOperationsSnapshot | null>(null);
  const [schemaHealth, setSchemaHealth] = useState<SchemaHealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifyOk, setNotifyOk] = useState<string | null>(null);
  const [orgScopeInput, setOrgScopeInput] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<"all" | "worker" | "export" | "alerts" | "queue">("all");
  const [selectedJob, setSelectedJob] = useState<RecentJobRow | null>(null);
  const [queueBusy, setQueueBusy] = useState<string | null>(null);
  const [alertSevFilter, setAlertSevFilter] = useState<"all" | "info" | "warning" | "critical">("all");
  const [replayOpen, setReplayOpen] = useState<"alerts" | "export_audit" | "retention" | null>(null);
  const [replayReason, setReplayReason] = useState("");
  const [replayBusy, setReplayBusy] = useState(false);

  const [lastSyncAtMs, setLastSyncAtMs] = useState<number | null>(null);
  const [browserOnline, setBrowserOnline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine
  );

  const mountedRef = useMountedRef();

  useEffect(() => {
    const up = () => setBrowserOnline(true);
    const down = () => setBrowserOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [res, healthRes] = await Promise.all([
        getSystemOperationsSnapshot({
          scopeOrganizationId: orgScopeInput.trim() || undefined,
        }),
        getSchemaHealthSnapshotForOps(),
      ]);
      if (!mountedRef.current) return;
      if ("error" in res) {
        setError(res.error);
        setSnapshot(null);
        setSchemaHealth(null);
        return;
      }
      setSnapshot(res);
      setSchemaHealth("snapshot" in healthRes ? healthRes.snapshot : null);
      setLastSyncAtMs(Date.now());
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgScopeInput, mountedRef]);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const me = await fetchMeRoleClient();
      if (!cancelled && me.ok && me.role === "super_admin") setIsSuperAdmin(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
      const ms = hidden ? 120_000 : 45_000;
      return window.setInterval(() => {
        void loadRef.current();
      }, ms);
    };
    let id = tick();
    const onVis = () => {
      window.clearInterval(id);
      id = tick();
      if (document.visibilityState === "visible") void loadRef.current();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVis);
    }
    return () => {
      window.clearInterval(id);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis);
      }
    };
  }, []);

  const runQueue = useCallback(
    async (key: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
      setQueueBusy(key);
      setError(null);
      setNotifyOk(null);
      try {
        const r = await fn();
        if (!r.ok) {
          setError(r.error ?? "İşlem başarısız");
          return;
        }
        setNotifyOk("Sunucu onayı alındı.");
        await load();
      } finally {
        setQueueBusy(null);
      }
    },
    [load]
  );

  const jobsByStatusChart = useMemo(() => {
    if (!snapshot) return [];
    return Object.entries(snapshot.queueStats.byStatus).map(([name, value]) => ({
      label: name,
      value: Number(value) || 0,
    }));
  }, [snapshot]);

  const analyticsSparkDlq = useMemo(() => {
    if (!snapshot) return [];
    const n = snapshot.queueAnalyticsBrief.dlqInSample;
    return [
      { k: "dlq", v: Math.max(0, n) },
      { k: "retry+", v: Math.round((snapshot.queueAnalyticsBrief.multiAttemptFraction ?? 0) * 100) },
    ];
  }, [snapshot]);

  const filteredOpenAlerts = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.operationalAlerts.filter((a) => {
      if (a.resolvedAt) return false;
      if (alertSevFilter !== "all" && a.severity !== alertSevFilter) return false;
      return true;
    });
  }, [snapshot, alertSevFilter]);

  const alertRuleGroupCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of filteredOpenAlerts) {
      m.set(a.ruleKey, (m.get(a.ruleKey) ?? 0) + 1);
    }
    return m;
  }, [filteredOpenAlerts]);

  const opsLiveTone: LiveStatusTone = !browserOnline
    ? "offline"
    : error
      ? "degraded"
      : refreshing
        ? "syncing"
        : "live";

  if (loading) {
    return (
      <div className="flex min-h-[50dvh] min-w-0 flex-col items-center justify-center gap-4 overflow-x-hidden px-4">
        <Loader2 className="animate-spin text-[#7c3aed]" size={44} aria-hidden />
        <p className="text-center text-[10px] font-black uppercase italic tracking-wide text-gray-500 sm:tracking-widest">
          Sistem operasyonları yükleniyor...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 pb-[max(4rem,env(safe-area-inset-bottom,0px))] min-w-0 overflow-x-hidden p-4 md:p-10">
      <header className="border-b border-white/5 pb-5 sm:pb-6 min-w-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl sm:text-4xl font-black italic text-white uppercase tracking-tighter leading-tight break-words">
            SİSTEM <span className="text-[#7c3aed]">OPERASYONLARI</span>
          </h1>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
            Retention cron, materialized view ve job durumu
          </p>
          <div className="mt-3 space-y-2">
            <LiveConnectionStrip
              status={opsLiveTone}
              lastSyncLabel={
                lastSyncAtMs != null ? formatRelativeTimeTr(new Date(lastSyncAtMs).toISOString()) : null
              }
            />
            <details className="rounded-lg border border-white/10 bg-black/20 p-2 text-[9px] text-gray-500">
              <summary className="cursor-pointer font-bold uppercase tracking-widest text-gray-400">
                Bu oturum — istemci realtime telemetri
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all">
                {JSON.stringify(getClientRealtimeStatsSnapshot(), null, 2)}
              </pre>
            </details>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={refreshing}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-[10px] font-black uppercase tracking-widest text-gray-200 disabled:cursor-not-allowed disabled:opacity-40 hover:border-[#7c3aed]/40 hover:text-white touch-manipulation"
        >
          {refreshing ? (
            <Loader2 className="size-3.5 animate-spin text-[#7c3aed]" aria-hidden />
          ) : (
            <RefreshCcw className="size-3.5 text-[#7c3aed]" aria-hidden />
          )}
          Yenile
        </button>
      </header>

      {error ? (
        <InlineErrorState
          errorKind="fetch_error"
          title={queryErrorCopy("fetch_error").title}
          description={error}
          onRetry={() => void load()}
        />
      ) : null}

      {snapshot && !error && (
        <>
          {notifyOk ? <Notification message={notifyOk} variant="success" /> : null}

          <ProductionHealthOverview snapshot={snapshot} />

          <section className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.07] px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-bold text-gray-300">
            <span className="inline-flex items-center gap-2 text-emerald-300 font-black uppercase tracking-widest">
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Canlı özet
            </span>
            <span className="inline-flex items-center gap-1 text-gray-400">
              <Radio size={14} className="shrink-0 text-gray-500" aria-hidden />
              Kuyruk: <span className="tabular-nums text-white">{snapshot.queueStats.byStatus.queued ?? 0}</span> bekleyen
            </span>
            <span className="inline-flex items-center gap-1 text-gray-400">
              <Cpu size={14} className="shrink-0 text-gray-500" aria-hidden />
              Worker:{" "}
              <span className="tabular-nums text-emerald-300">
                {snapshot.queueAnalyticsBrief.workerPulseActive}/{snapshot.queueAnalyticsBrief.workerPulseTotal}
              </span>{" "}
              nabız
            </span>
            <span className="text-gray-400">
              Export aktif:{" "}
              <span className="tabular-nums text-white">{snapshot.activeExportJobsCount}</span>
            </span>
            <span className="text-gray-400">
              Uyarı: <span className="tabular-nums text-amber-300">{snapshot.openOperationalAlertsCount}</span> açık
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-md border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-red-200"
              title="Dead-letter kuyruğundaki iş sayısı"
            >
              <Skull size={12} aria-hidden />
              DLQ: <span className="tabular-nums">{snapshot.queueStats.deadLetterCount}</span>
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5"
              title="Son 60 dakikada kuyruğa alınan iş tahmini"
            >
              <Gauge size={12} className="text-[#7c3aed]" aria-hidden />
              ~{snapshot.queueAnalyticsBrief.jobsPerMinuteEstimate?.toFixed(1) ?? "—"}/dk
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5"
              title="Son 24 saatte tamamlanan export sayısı ve satır"
            >
              <TrendingUp size={12} className="text-emerald-400" aria-hidden />
              Export 24s: {snapshot.queueAnalyticsBrief.exportsFinishedLast24h} (
              {snapshot.queueAnalyticsBrief.exportRowsLast24h} satır)
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5"
              title="En son worker heartbeat"
            >
              <Clock size={12} className="text-gray-500" aria-hidden />
              Tick:{" "}
              {formatDateTime(
                snapshot.activeWorkers.find((w) => w.isActive)?.lastTickAt ??
                  snapshot.activeWorkers[0]?.lastTickAt
              )}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5"
              title="pg_cron retention job son çalışma"
            >
              <Database size={12} className="text-gray-500" aria-hidden />
              Cron:{" "}
              {formatDateTime(
                snapshot.cronJobs.find((j) => j.jobname.includes("retention"))?.lastRunStartedAt ??
                  snapshot.cronJobs[0]?.lastRunStartedAt
              )}
            </span>
            <span className="text-[9px] text-gray-500 sm:ml-auto">
              Otomatik yenileme (45s / sekme gizliyken 120s) · Son: {formatDateTime(snapshot.generatedAt)}
            </span>
          </section>

          {schemaHealth ? (
            <section
              className={`rounded-2xl border px-4 py-3 ${
                schemaHealth.ok
                  ? "border-emerald-500/25 bg-emerald-500/5"
                  : "border-amber-500/30 bg-amber-500/10"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-white">
                  Migration / şema sağlığı
                </p>
                <span
                  className={`rounded-md px-2 py-0.5 text-[9px] font-black uppercase ${
                    schemaHealth.ok ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/20 text-amber-200"
                  }`}
                >
                  {schemaHealth.ok ? "Uyumlu" : "Drift tespit edildi"}
                </span>
              </div>
              <ul className="mt-2 grid gap-1 text-[10px] font-semibold text-gray-300 sm:grid-cols-2">
                <li>
                  lifecycle_status:{" "}
                  {schemaHealth.packages.lifecycleStatus ? "✓" : "eksik (FAZ 18)"}
                </li>
                <li>voided_at (PLP): {schemaHealth.payments.privateLessonVoidedAt ? "✓" : "eksik (FAZ 19)"}</li>
                <li>
                  package_events: {schemaHealth.packages.packageEventsTable ? "✓" : "eksik (FAZ 18)"}
                </li>
                <li>
                  void RPC: {schemaHealth.payments.privateLessonVoidRpc ? "✓" : "eksik (FAZ 19)"}
                </li>
              </ul>
              {schemaHealth.driftWarnings.length > 0 ? (
                <ul className="mt-2 list-inside list-disc text-[10px] text-amber-100/90">
                  {schemaHealth.driftWarnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-2 text-[9px] text-gray-500">
                Algılama: {formatDateTime(schemaHealth.detectedAt)}
              </p>
            </section>
          ) : null}

          {/* Faz 13.1 — Worker recovery kartları */}
          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-[#121215] p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Stuck rescue (24sa)</p>
              <p className="mt-2 text-2xl font-black text-emerald-400 tabular-nums">
                {snapshot.workerRecovery24h.rescuedJobs}
              </p>
              <p className="mt-1 text-[10px] font-bold text-gray-500">Requeued (heartbeat window)</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#121215] p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">DLQ finalize (24sa)</p>
              <p className="mt-2 text-2xl font-black text-red-400 tabular-nums">
                {snapshot.workerRecovery24h.deadJobs}
              </p>
              <p className="mt-1 text-[10px] font-bold text-gray-500">Stuck + max attempts</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#121215] p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Retry storms (24sa)</p>
              <p className="mt-2 text-2xl font-black text-amber-400 tabular-nums">
                {snapshot.workerRecovery24h.retryStorms}
              </p>
              <p className="mt-1 text-[10px] font-bold text-gray-500">Telemetry tick sayısı</p>
            </div>
          </section>

          {isSuperAdmin ? (
            <section className="rounded-2xl border border-white/5 bg-[#121215] p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-sm font-black uppercase text-white tracking-widest">Super admin — org daraltma</h2>
                  <p className="mt-1 text-[10px] font-bold text-gray-500">
                    Job listesi ve kuyruk aksiyonları için organizasyon UUID (daraltılmazsa tüm tenant örnekleri).
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={orgScopeInput}
                    onChange={(e) => setOrgScopeInput(e.target.value)}
                    placeholder="Organizasyon UUID"
                    className="min-h-11 min-w-[12rem] flex-1 rounded-xl border border-white/10 bg-black/40 px-3 text-[11px] font-mono text-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => void load()}
                    disabled={refreshing}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#7c3aed]/40 bg-[#7c3aed]/10 px-4 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-40"
                  >
                    Uygula
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {/* Faz 14.2 — Rate limiter runtime */}
          <section className="rounded-2xl border border-white/5 bg-[#121215] p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Gauge size={18} className="text-[#7c3aed]" aria-hidden />
              <h2 className="text-sm font-black uppercase text-white tracking-widest">Rate limiter</h2>
              {snapshot.rateLimiterRuntime.limiterUnhealthyBackendHits > 0 ? (
                <span className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-red-300">
                  Çift backend hatası
                </span>
              ) : null}
              {snapshot.rateLimiterRuntime.limiterDegradedHits > 0 ? (
                <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-200">
                  Degraded (fallback)
                </span>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-[11px] font-bold text-gray-400">
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Aktif adapter</p>
                <p className="mt-1 font-mono text-white">{snapshot.rateLimiterRuntime.activeAdapter}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Fallback adapter</p>
                <p className="mt-1 font-mono text-white">{snapshot.rateLimiterRuntime.fallbackAdapter}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Fallback sayısı</p>
                <p className="mt-1 tabular-nums text-amber-300">{snapshot.rateLimiterRuntime.limiterFallbackCount}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-600">Son hata</p>
                <p className="mt-1 break-words text-gray-300">
                  {snapshot.rateLimiterRuntime.lastLimiterFailureReason ?? "—"}
                </p>
              </div>
            </div>
            {snapshot.rateLimiterRuntime.recentAdapterSwitches.length > 0 ? (
              <div className="mt-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-600 mb-2">Adapter geçmişi</p>
                <ul className="max-h-28 overflow-y-auto custom-scrollbar space-y-1 text-[10px] font-mono text-gray-400">
                  {snapshot.rateLimiterRuntime.recentAdapterSwitches
                    .slice()
                    .reverse()
                    .map((s, i) => (
                      <li key={`${s.switchedAt}-${i}`}>
                        {formatDateTime(s.switchedAt)} · {s.active} / fb {s.fallback}
                      </li>
                    ))}
                </ul>
              </div>
            ) : (
              <p className="mt-3 text-[10px] font-bold text-gray-600">Bu process için adapter geçişi kaydı yok.</p>
            )}
          </section>

          {/* Faz 14.5 — Kuyruk analitiği (aggregate) */}
          <section className="rounded-2xl border border-white/5 bg-[#121215] p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={18} className="text-[#7c3aed]" aria-hidden />
              <h2 className="text-sm font-black uppercase text-white tracking-widest">Kuyruk analitiği</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-[11px] mb-4">
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="text-[9px] font-black uppercase text-gray-600">Job/dk (60dk örnek)</p>
                <p className="mt-1 tabular-nums text-white text-lg font-black">
                  {snapshot.queueAnalyticsBrief.jobsPerMinuteEstimate != null
                    ? snapshot.queueAnalyticsBrief.jobsPerMinuteEstimate.toFixed(2)
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="text-[9px] font-black uppercase text-gray-600">Çoklu deneme oranı</p>
                <p className="mt-1 tabular-nums text-amber-300 text-lg font-black">
                  {snapshot.queueAnalyticsBrief.multiAttemptFraction != null
                    ? `${Math.round(snapshot.queueAnalyticsBrief.multiAttemptFraction * 100)}%`
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="text-[9px] font-black uppercase text-gray-600">Export satır/dk (24s)</p>
                <p className="mt-1 tabular-nums text-emerald-300 text-lg font-black">
                  {snapshot.queueAnalyticsBrief.exportRowsPerMinuteEstimate != null
                    ? Math.round(snapshot.queueAnalyticsBrief.exportRowsPerMinuteEstimate)
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="text-[9px] font-black uppercase text-gray-600">Export tamam (24s)</p>
                <p className="mt-1 tabular-nums text-white text-lg font-black">
                  {snapshot.queueAnalyticsBrief.exportsFinishedLast24h}
                </p>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="text-[9px] font-black uppercase text-gray-600 mb-2">Durum dağılımı (son 100)</p>
                <ChartFrame isEmpty={jobsByStatusChart.length === 0} emptyLabel="JOB YOK" heightClassName="h-[200px]">
                  <BarChart data={jobsByStatusChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                    <YAxis width={32} tick={{ fill: "#9ca3af", fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={chartTooltipStyle.contentStyle} itemStyle={chartTooltipStyle.itemStyle} />
                    <Bar dataKey="value" fill="#7c3aed" radius={[4, 4, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ChartFrame>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase text-gray-600 mb-2">DLQ vs retry+ yoğunluğu</p>
                <ChartFrame isEmpty={analyticsSparkDlq.length === 0} emptyLabel="VERİ YOK" heightClassName="h-[200px]">
                  <BarChart data={analyticsSparkDlq} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="k" tick={{ fill: "#9ca3af", fontSize: 10 }} />
                    <YAxis width={32} tick={{ fill: "#9ca3af", fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={chartTooltipStyle.contentStyle} itemStyle={chartTooltipStyle.itemStyle} />
                    <Bar dataKey="v" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ChartFrame>
              </div>
            </div>
          </section>

          {/* Faz 14.7 — Operational replay */}
          <section className="rounded-2xl border border-white/5 bg-[#121215] p-5 sm:p-6">
            <h2 className="text-sm font-black uppercase text-white tracking-widest mb-3">Operasyon replay</h2>
            <p className="text-[10px] font-bold text-gray-500 mb-3">
              Tümü audit kaydı üretir. Retention yalnızca super_admin.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!!queueBusy || replayBusy}
                onClick={() => {
                  setReplayOpen("alerts");
                  setReplayReason("");
                }}
                className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 text-[9px] font-black uppercase tracking-widest text-gray-200"
              >
                Uyarı değerlendirme
              </button>
              <button
                type="button"
                disabled={!!queueBusy || replayBusy}
                onClick={() => {
                  setReplayOpen("export_audit");
                  setReplayReason("");
                }}
                className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 text-[9px] font-black uppercase tracking-widest text-gray-200"
              >
                Audit export job
              </button>
              {isSuperAdmin ? (
                <button
                  type="button"
                  disabled={!!queueBusy || replayBusy}
                  onClick={() => {
                    setReplayOpen("retention");
                    setReplayReason("");
                  }}
                  className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 text-[9px] font-black uppercase tracking-widest text-amber-200"
                >
                  Retention audit
                </button>
              ) : null}
            </div>
          </section>

          {/* Faz 13.3 / 14.4 — Operasyonel uyarılar */}
          <section className="rounded-2xl border border-white/5 bg-[#121215] p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-400" aria-hidden />
                <h2 className="text-sm font-black uppercase text-white tracking-widest">Operasyonel uyarılar</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["all", "critical", "warning", "info"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setAlertSevFilter(k)}
                    className={`rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-widest ${
                      alertSevFilter === k
                        ? "border-[#7c3aed]/50 bg-[#7c3aed]/15 text-white"
                        : "border-white/10 bg-white/5 text-gray-400"
                    }`}
                  >
                    {k === "all" ? "Tümü" : k}
                  </button>
                ))}
              </div>
            </div>
            {filteredOpenAlerts.length === 0 ? (
              <p className="text-[11px] font-bold text-gray-500">Bu filtreye uygun açık uyarı yok.</p>
            ) : (
              <ul className="space-y-2">
                {filteredOpenAlerts.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 flex flex-wrap items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-black text-white break-words">{a.title}</p>
                      <p className="mt-1 text-[10px] font-mono text-gray-500 break-all">{a.ruleKey}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[9px] font-bold text-gray-500">
                        {a.acknowledgedAt ? (
                          <span className="rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-sky-200">
                            Onaylı
                          </span>
                        ) : (
                          <span className="rounded border border-white/10 px-1.5 py-0.5">Açık</span>
                        )}
                        {a.escalationCount > 0 ? (
                          <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-red-200">
                            Eskalasyon ×{a.escalationCount}
                          </span>
                        ) : null}
                        {a.noiseSuppressed ? (
                          <span className="rounded border border-gray-600/50 px-1.5 py-0.5 text-gray-400">
                            Sessiz (cooldown)
                          </span>
                        ) : null}
                        {(alertRuleGroupCounts.get(a.ruleKey) ?? 0) > 1 ? (
                          <span className="rounded border border-amber-500/30 px-1.5 py-0.5 text-amber-200">
                            Tekrarlı kural: {alertRuleGroupCounts.get(a.ruleKey)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${alertSeverityClass(a.severity)}`}
                      >
                        {a.severity}
                      </span>
                      <div className="flex flex-wrap justify-end gap-1">
                        <button
                          type="button"
                          disabled={!!queueBusy || Boolean(a.acknowledgedAt)}
                          onClick={() => {
                            void (async () => {
                              setQueueBusy(`ack-${a.id}`);
                              setError(null);
                              try {
                                const r = await acknowledgeOperationalAlert({ alertId: a.id });
                                if (!r.ok) {
                                  setError(r.error);
                                  return;
                                }
                                setNotifyOk("Uyarı onaylandı.");
                                await load();
                              } finally {
                                setQueueBusy(null);
                              }
                            })();
                          }}
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-black uppercase text-gray-200 disabled:opacity-40"
                        >
                          Onayla
                        </button>
                        <button
                          type="button"
                          disabled={!!queueBusy}
                          onClick={() => {
                            void (async () => {
                              setQueueBusy(`res-${a.id}`);
                              setError(null);
                              try {
                                const r = await resolveOperationalAlert({ alertId: a.id });
                                if (!r.ok) {
                                  setError(r.error);
                                  return;
                                }
                                setNotifyOk("Uyarı çözümlendi.");
                                await load();
                              } finally {
                                setQueueBusy(null);
                              }
                            })();
                          }}
                          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[9px] font-black uppercase text-emerald-200 disabled:opacity-40"
                        >
                          Çözümle
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-[10px] font-bold text-gray-600">
              Çözümlenen uyarılar listeden düşer; geçmiş için veritabanı / timeline kullanılır.
            </p>
          </section>

          {/* Faz 13.7 — Operasyon timeline */}
          <section className="rounded-2xl border border-white/5 bg-[#121215] p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div className="flex items-center gap-2">
                <History size={18} className="text-[#7c3aed]" aria-hidden />
                <h2 className="text-sm font-black uppercase text-white tracking-widest">Operasyon zaman çizelgesi</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["all", "Tümü"],
                    ["worker", "Worker"],
                    ["export", "Export"],
                    ["alerts", "Uyarı"],
                    ["queue", "Queue"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTimelineFilter(key)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-widest touch-manipulation ${
                      timelineFilter === key
                        ? "border-[#7c3aed]/50 bg-[#7c3aed]/15 text-white"
                        : "border-white/10 bg-white/5 text-gray-400"
                    }`}
                  >
                    <ListFilter size={12} aria-hidden />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {(() => {
              const rows = snapshot.operationalTimeline.filter((t) => {
                if (timelineFilter === "all") return true;
                if (timelineFilter === "worker") return t.eventType.startsWith("worker.");
                if (timelineFilter === "export") return t.eventType.includes("export");
                if (timelineFilter === "alerts") return t.severity !== "info";
                if (timelineFilter === "queue") return t.eventType.startsWith("queue.");
                return true;
              });
              if (rows.length === 0) {
                return (
                  <EmptyState
                    icon={History}
                    title="Kayıt yok."
                    description="Filtreyi değiştirin veya worker / queue aksiyonlarını tetikleyin."
                    variant="no_data"
                  />
                );
              }
              return (
                <ul className="space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar">
                  {rows.slice(0, 40).map((t) => (
                    <li
                      key={t.id}
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 flex flex-wrap gap-2 items-start justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-[10px] font-mono text-gray-500">{t.eventType}</p>
                        <p className="text-[11px] font-bold text-gray-200 break-words">{t.summary}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5 text-[8px] font-black uppercase tracking-widest ${alertSeverityClass(t.severity)}`}
                        >
                          {t.severity}
                        </span>
                        <p className="mt-1 text-[9px] text-gray-500 whitespace-nowrap">
                          {formatDateTime(t.createdAt)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </section>

          {/* Cron Jobs */}
          <section className="rounded-2xl border border-white/5 bg-[#121215] p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <ServerCog size={18} className="text-[#7c3aed]" aria-hidden />
              <h2 className="text-sm font-black uppercase text-white tracking-widest">Cron Job Durumu</h2>
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                  snapshot.cronAvailable
                    ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border border-amber-500/30 bg-amber-500/10 text-amber-400"
                }`}
              >
                {snapshot.cronAvailable ? "pg_cron aktif" : "pg_cron yok"}
              </span>
            </div>
            {!snapshot.cronAvailable ? (
              <EmptyState
                icon={ShieldCheck}
                title="pg_cron extension bulunamadı."
                description="Retention ve MV refresh otomasyonu manuel olarak çalıştırılmalı. Üretim ortamında migration uygulayın: 20260511_retention_pg_cron.sql"
                variant="no_data"
              />
            ) : snapshot.cronJobs.length === 0 ? (
              <EmptyState
                icon={ServerCog}
                title="Henüz cron job kaydı yok."
                description="Migration uygulandı mı? `peaker_retention_*` ve `peaker_mv_*` job adlarını kontrol edin."
                variant="no_data"
              />
            ) : (
              <div className="grid gap-3">
                {snapshot.cronJobs.map((job) => (
                  <div
                    key={job.jobname}
                    className="rounded-xl border border-white/10 bg-black/30 p-4 min-w-0"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-white break-words">{job.jobname}</p>
                        <p className="mt-1 text-[10px] font-bold text-gray-500">
                          Plan: <span className="font-mono text-gray-300">{job.schedule ?? "-"}</span>
                          {" · "}
                          <span className={job.active === false ? "text-amber-400" : "text-emerald-400"}>
                            {job.active === false ? "Devre dışı" : "Aktif"}
                          </span>
                        </p>
                      </div>
                      {job.lastRunStatus && (
                        <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${statusToneClass(job.lastRunStatus)}`}>
                          {job.lastRunStatus}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 text-[10px] font-bold text-gray-500">
                      <div>
                        <p className="uppercase tracking-widest text-gray-600">Son Çalışma</p>
                        <p className="mt-0.5 text-gray-300">{formatDateTime(job.lastRunStartedAt)}</p>
                      </div>
                      <div>
                        <p className="uppercase tracking-widest text-gray-600">Süre</p>
                        <p className="mt-0.5 text-gray-300">{formatDuration(job.lastRunDurationMs)}</p>
                      </div>
                      {job.lastRunMessage && (
                        <div className="col-span-2 sm:col-span-1 min-w-0">
                          <p className="uppercase tracking-widest text-gray-600">Mesaj</p>
                          <p className="mt-0.5 text-gray-300 break-words">{job.lastRunMessage}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Recent Retention Runs */}
          <section className="rounded-2xl border border-white/5 bg-[#121215] p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Clock size={18} className="text-[#7c3aed]" aria-hidden />
              <h2 className="text-sm font-black uppercase text-white tracking-widest">Son 7 Gün Retention Run&apos;ları</h2>
            </div>
            {snapshot.recentRetentionRuns.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="Henüz retention çalıştırması yok."
                description="pg_cron 03:15 ve 03:30 UTC'de çalıştırır. İlk run sonrası burada görünür."
                variant="no_data"
              />
            ) : (
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="min-w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-white/5 text-[9px] font-black uppercase tracking-widest text-gray-500">
                      <th className="px-3 py-2">Job</th>
                      <th className="px-3 py-2">Başlangıç</th>
                      <th className="px-3 py-2">Durum</th>
                      <th className="px-3 py-2">Süre</th>
                      <th className="px-3 py-2">Mesaj</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.recentRetentionRuns.map((run, idx) => (
                      <tr key={`${run.jobname}-${run.startTime}-${idx}`} className="border-b border-white/5 last:border-0">
                        <td className="px-3 py-2 font-bold text-white whitespace-nowrap">{run.jobname}</td>
                        <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{formatDateTime(run.startTime)}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${statusToneClass(run.status)}`}>
                            {run.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{formatDuration(run.durationMs)}</td>
                        <td className="px-3 py-2 text-gray-400 break-words min-w-0 max-w-[24ch]">
                          {run.returnMessage || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Materialized Views */}
          <section className="rounded-2xl border border-white/5 bg-[#121215] p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Database size={18} className="text-[#7c3aed]" aria-hidden />
              <h2 className="text-sm font-black uppercase text-white tracking-widest">Materialized View Durumu</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {snapshot.materializedViews.map((mv) => (
                <div key={mv.name} className="rounded-xl border border-white/10 bg-black/30 p-4 min-w-0">
                  <p className="text-xs font-black text-white break-words">{mv.name}</p>
                  {mv.available ? (
                    <>
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">Son Refresh</p>
                      <p className="text-gray-300 text-[11px] font-bold">{formatDateTime(mv.refreshedAt)}</p>
                    </>
                  ) : (
                    <p className="mt-2 text-[10px] font-bold text-amber-400 break-words">
                      Erişilemedi: {mv.reason || "neden bilinmiyor"}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Faz 12.8 — MV freshness indicators */}
          <section className="rounded-2xl border border-white/5 bg-[#121215] p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Database size={18} className="text-[#7c3aed]" aria-hidden />
              <h2 className="text-sm font-black uppercase text-white tracking-widest">MV Freshness</h2>
            </div>
            {snapshot.mvFreshness.length === 0 ? (
              <EmptyState
                icon={Database}
                title="Materialized view bilgisi yok."
                description="MV migration'ları çalışmamış olabilir."
                variant="no_data"
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {snapshot.mvFreshness.map((mv) => (
                  <div
                    key={mv.name}
                    className="rounded-xl border border-white/10 bg-black/30 p-4 min-w-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-black text-white break-words">{mv.name}</p>
                      <span
                        className={`shrink-0 rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${mvStalenessToneClass(mv.staleness)}`}
                      >
                        {mvStalenessLabel(mv.staleness)}
                      </span>
                    </div>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      Yaş
                    </p>
                    <p className="text-gray-300 text-[11px] font-bold">
                      {mv.ageMinutes == null
                        ? "-"
                        : mv.ageMinutes < 60
                          ? `${mv.ageMinutes} dk`
                          : `${(mv.ageMinutes / 60).toFixed(1)} sa`}
                    </p>
                    <p className="mt-1 text-[10px] font-bold text-gray-500">
                      Son refresh: {formatDateTime(mv.refreshedAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Faz 12.8 — Active workers */}
          <section className="rounded-2xl border border-white/5 bg-[#121215] p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Cpu size={18} className="text-[#7c3aed]" aria-hidden />
              <h2 className="text-sm font-black uppercase text-white tracking-widest">Aktif Worker&apos;lar</h2>
              <span className="ml-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-gray-300">
                {snapshot.activeWorkers.filter((w) => w.isActive).length} aktif /{" "}
                {snapshot.activeWorkers.length} toplam
              </span>
            </div>
            {snapshot.activeWorkers.length === 0 ? (
              <EmptyState
                icon={Cpu}
                title="Worker heartbeat'i yok."
                description="Henüz worker tick'i çalışmamış veya pgmq aktif değil. Vercel cron / pg_cron tetikleyici kontrol edin."
                variant="no_data"
              />
            ) : (
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="min-w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-white/5 text-[9px] font-black uppercase tracking-widest text-gray-500">
                      <th className="px-3 py-2">Worker</th>
                      <th className="px-3 py-2">Kaynak</th>
                      <th className="px-3 py-2">Son Tick</th>
                      <th className="px-3 py-2">İşlenen</th>
                      <th className="px-3 py-2">OK / Fail / DLQ</th>
                      <th className="px-3 py-2">Rescue / DLQ</th>
                      <th className="px-3 py-2">Storm</th>
                      <th className="px-3 py-2">Süre</th>
                      <th className="px-3 py-2">Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.activeWorkers.map((w) => (
                      <tr key={w.workerId} className="border-b border-white/5 last:border-0">
                        <td className="px-3 py-2 font-bold text-white whitespace-nowrap font-mono text-[10px]">
                          {w.workerId}
                        </td>
                        <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{w.source}</td>
                        <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                          {formatDateTime(w.lastTickAt)}
                        </td>
                        <td className="px-3 py-2 text-gray-300 tabular-nums">{w.processedCount}</td>
                        <td className="px-3 py-2 tabular-nums">
                          <span className="text-emerald-400">{w.succeededCount}</span>
                          {" / "}
                          <span className="text-amber-400">{w.failedCount}</span>
                          {" / "}
                          <span className="text-red-400">{w.deadLetterCount}</span>
                        </td>
                        <td className="px-3 py-2 text-[10px] text-gray-400 tabular-nums whitespace-nowrap">
                          <span className="text-emerald-400">{w.rescueRescuedCount ?? 0}</span>
                          {" / "}
                          <span className="text-red-400">{w.rescueDeadStuckCount ?? 0}</span>
                        </td>
                        <td className="px-3 py-2 text-gray-400 text-[10px]">
                          {w.retryStormDetected ? (
                            <span className="text-amber-400 font-black">EVET</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                          {formatDuration(w.durationMs)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                              w.isActive
                                ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                                : "text-gray-500 border-white/10 bg-white/5"
                            }`}
                          >
                            {w.isActive ? "Aktif" : "Bekliyor"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Queue & Recent Jobs — Faz 11.8 + Faz 12.8 */}
          <section className="rounded-2xl border border-white/5 bg-[#121215] p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity size={18} className="text-[#7c3aed]" aria-hidden />
              <h2 className="text-sm font-black uppercase text-white tracking-widest">Async Queue Durumu</h2>
              <span
                className={`ml-2 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                  snapshot.queueStats.available
                    ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border border-amber-500/30 bg-amber-500/10 text-amber-400"
                }`}
              >
                {snapshot.queueStats.available ? "peaker_jobs_log aktif" : "queue yok"}
              </span>
            </div>
            {!snapshot.queueStats.available ? (
              <EmptyState
                icon={Activity}
                title="Async job kuyruğu kurulu değil."
                description={
                  snapshot.queueStats.reason ||
                  "Migration uygulayın: 20260513_pgmq_jobs.sql. ENV: PEAKER_QUEUE_ADAPTER=pgmq"
                }
                variant="no_data"
              />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Toplam (son 100)</p>
                    <p className="mt-1 text-xl font-black text-white tabular-nums">
                      {snapshot.queueStats.total}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Queued</p>
                    <p className="mt-1 text-xl font-black text-amber-300 tabular-nums">
                      {snapshot.queueStats.byStatus.queued ?? 0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Failed (24h)</p>
                    <p className="mt-1 text-xl font-black text-red-300 tabular-nums">
                      {snapshot.queueStats.failedRecentCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className="flex items-center gap-1">
                      <AlertTriangle size={11} className="text-red-400" aria-hidden />
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">
                        DLQ
                      </p>
                    </div>
                    <p className="mt-1 text-xl font-black text-red-400 tabular-nums">
                      {snapshot.queueStats.deadLetterCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Avg süre</p>
                    <p className="mt-1 text-base font-black text-white tabular-nums">
                      {formatDuration(snapshot.queueStats.averageDurationMs)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <div className="flex items-center gap-1">
                      <TrendingUp size={11} className="text-amber-300" aria-hidden />
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">
                        p95 süre
                      </p>
                    </div>
                    <p className="mt-1 text-base font-black text-amber-300 tabular-nums">
                      {formatDuration(snapshot.queueStats.p95DurationMs)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">En eski queued</p>
                    <p className="mt-1 text-[11px] font-bold text-gray-300">
                      {formatDateTime(snapshot.queueStats.oldestQueuedAt)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Export Süreleri</p>
                    <ExportDurationSparkline samples={snapshot.exportDurationSamples} />
                  </div>
                </div>
                <div className="mb-4 flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:flex-wrap sm:items-center">
                  <p className="shrink-0 text-[10px] font-black uppercase tracking-widest text-gray-500">
                    Queue aksiyonları
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={
                        !!queueBusy ||
                        !resolveBulkOrganizationId(snapshot, isSuperAdmin, orgScopeInput)
                      }
                      onClick={() =>
                        void runQueue("retry_all", () =>
                          queueAdminRetryAllRetryable({
                            organizationId: resolveBulkOrganizationId(snapshot, isSuperAdmin, orgScopeInput)!,
                          })
                        )
                      }
                      className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 text-[9px] font-black uppercase tracking-widest text-gray-200 disabled:opacity-40"
                    >
                      <RotateCcw size={12} aria-hidden />
                      {queueBusy === "retry_all" ? <Loader2 className="size-3 animate-spin" /> : null}
                      Tümünü retry
                    </button>
                    <button
                      type="button"
                      disabled={
                        !!queueBusy ||
                        !resolveBulkOrganizationId(snapshot, isSuperAdmin, orgScopeInput)
                      }
                      onClick={() =>
                        void runQueue("purge", () =>
                          queueAdminPurgeCompleted({
                            organizationId: resolveBulkOrganizationId(snapshot, isSuperAdmin, orgScopeInput)!,
                            olderThanDays: 30,
                          })
                        )
                      }
                      className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 text-[9px] font-black uppercase tracking-widest text-amber-200 disabled:opacity-40"
                    >
                      <Skull size={12} aria-hidden />
                      {queueBusy === "purge" ? <Loader2 className="size-3 animate-spin" /> : null}
                      Tamamlananları temizle
                    </button>
                  </div>
                  {!resolveBulkOrganizationId(snapshot, isSuperAdmin, orgScopeInput) && isSuperAdmin ? (
                    <p className="text-[10px] font-bold text-amber-400">
                      Super admin: org UUID girin veya job listesinden org bağlamı oluşsun.
                    </p>
                  ) : null}
                </div>
                {snapshot.recentJobs.length === 0 ? (
                  <EmptyState
                    icon={Activity}
                    title="Henüz job kaydı yok."
                    description="Async export veya retention çalıştırıldığında burada görünür."
                    variant="no_data"
                  />
                ) : (
                  <div className="overflow-x-auto -mx-2 px-2">
                    <table className="min-w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-white/5 text-[9px] font-black uppercase tracking-widest text-gray-500">
                          <th className="px-3 py-2">Kind</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Attempts</th>
                          <th className="px-3 py-2">Enqueued</th>
                          <th className="px-3 py-2">Finished</th>
                          <th className="px-3 py-2">Hata</th>
                          <th className="px-3 py-2 text-right">İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snapshot.recentJobs.slice(0, 15).map((job) => (
                          <tr key={job.id} className="border-b border-white/5 last:border-0">
                            <td className="px-3 py-2 font-bold text-white whitespace-nowrap">{job.kind}</td>
                            <td className="px-3 py-2">
                              <span
                                className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${statusToneClass(
                                  job.status
                                )}`}
                              >
                                {job.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-400 tabular-nums">
                              {job.attempts}/{job.maxAttempts}
                            </td>
                            <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{formatDateTime(job.enqueuedAt)}</td>
                            <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{formatDateTime(job.finishedAt)}</td>
                            <td className="px-3 py-2 text-gray-400 break-words min-w-0 max-w-[20ch]">
                              {job.errorMessage || "-"}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedJob(job)}
                                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-[#7c3aed] hover:border-[#7c3aed]/40"
                              >
                                Detay
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>

          {replayOpen ? (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
              role="dialog"
              aria-modal="true"
              aria-labelledby="replay-modal-title"
            >
              <button
                type="button"
                className="absolute inset-0 cursor-default"
                aria-label="Kapat"
                onClick={() => !replayBusy && setReplayOpen(null)}
              />
              <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#121215] p-5 shadow-xl">
                <div className="flex items-start justify-between gap-2">
                  <h3 id="replay-modal-title" className="text-sm font-black uppercase text-white tracking-widest">
                    Replay
                  </h3>
                  <button
                    type="button"
                    disabled={replayBusy}
                    onClick={() => setReplayOpen(null)}
                    className="rounded-lg border border-white/10 p-1.5 text-gray-400 hover:text-white disabled:opacity-40"
                  >
                    <X size={16} aria-hidden />
                  </button>
                </div>
                <p className="mt-2 text-[10px] font-bold text-gray-500">
                  {replayOpen === "alerts" && "Snapshot üzerinden uyarı kuralları yeniden değerlendirilir."}
                  {replayOpen === "export_audit" && "Audit CSV export async job kuyruğa alınır."}
                  {replayOpen === "retention" && "Audit log retention denetim job tetiklenir (super_admin)."}
                </p>
                <p className="mt-1 text-[9px] font-semibold text-amber-300/90">
                  Aynı işlem 60 saniye içinde tekrar tetiklenemez (replay cooldown).
                </p>
                <label className="mt-4 block text-[9px] font-black uppercase tracking-widest text-gray-500">
                  Sebep (metadata)
                  <textarea
                    value={replayReason}
                    onChange={(e) => setReplayReason(e.target.value)}
                    rows={3}
                    disabled={replayBusy}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-gray-200"
                    placeholder="Opsiyonel — audit metadata"
                  />
                </label>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={replayBusy}
                    onClick={() => setReplayOpen(null)}
                    className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-black uppercase text-gray-300"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    disabled={replayBusy}
                    onClick={() => {
                      void (async () => {
                        setReplayBusy(true);
                        setError(null);
                        setNotifyOk(null);
                        try {
                          if (replayOpen === "alerts") {
                            const r = await replayOperationalAlertEvaluation({
                              replayReason: replayReason.trim() || null,
                            });
                            if (!r.ok) {
                              setError(r.error);
                              return;
                            }
                          } else if (replayOpen === "export_audit") {
                            const org = resolveBulkOrganizationId(snapshot, isSuperAdmin, orgScopeInput);
                            const r = await replayEnqueueAuditExport({
                              organizationId: org,
                              replayReason: replayReason.trim() || null,
                            });
                            if (!r.ok) {
                              setError(r.error);
                              return;
                            }
                          } else if (replayOpen === "retention") {
                            const r = await replayEnqueueRetentionAudit({
                              replayReason: replayReason.trim() || null,
                            });
                            if (!r.ok) {
                              setError(r.error);
                              return;
                            }
                          }
                          setNotifyOk("Replay tamamlandı.");
                          setReplayOpen(null);
                          await load();
                        } finally {
                          setReplayBusy(false);
                        }
                      })();
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#7c3aed]/40 bg-[#7c3aed]/15 px-3 py-2 text-[10px] font-black uppercase text-white disabled:opacity-40"
                  >
                    {replayBusy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                    Çalıştır
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {selectedJob ? (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
              role="dialog"
              aria-modal="true"
              aria-labelledby="job-detail-title"
            >
              <button
                type="button"
                className="absolute inset-0 cursor-default"
                aria-label="Kapat"
                onClick={() => setSelectedJob(null)}
              />
              <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#121215] p-5 shadow-xl custom-scrollbar">
                <div className="flex items-start justify-between gap-2">
                  <h3 id="job-detail-title" className="text-sm font-black uppercase text-white tracking-widest">
                    Job detayı
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelectedJob(null)}
                    className="rounded-lg border border-white/10 p-1.5 text-gray-400 hover:text-white"
                  >
                    <X size={16} aria-hidden />
                  </button>
                </div>
                <dl className="mt-4 space-y-2 text-[11px]">
                  <div>
                    <dt className="text-[9px] font-black uppercase text-gray-500">ID</dt>
                    <dd className="font-mono text-gray-300 break-all">{selectedJob.id}</dd>
                  </div>
                  <div>
                    <dt className="text-[9px] font-black uppercase text-gray-500">Kind</dt>
                    <dd className="font-bold text-white">{selectedJob.kind}</dd>
                  </div>
                  <div>
                    <dt className="text-[9px] font-black uppercase text-gray-500">Status</dt>
                    <dd>
                      <span
                        className={`inline-flex rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${statusToneClass(
                          selectedJob.status
                        )}`}
                      >
                        {selectedJob.status}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[9px] font-black uppercase text-gray-500">Attempts</dt>
                    <dd className="text-gray-300">
                      {selectedJob.attempts}/{selectedJob.maxAttempts}
                    </dd>
                  </div>
                  {selectedJob.errorMessage ? (
                    <div>
                      <dt className="text-[9px] font-black uppercase text-gray-500">Hata</dt>
                      <dd className="text-gray-400 break-words">{selectedJob.errorMessage}</dd>
                    </div>
                  ) : null}
                </dl>
                <div className="mt-5 flex flex-wrap gap-2">
                  {(selectedJob.status === "failed" || selectedJob.status === "dead_letter") && (
                    <button
                      type="button"
                      disabled={!!queueBusy}
                      onClick={() => {
                        const id = selectedJob.id;
                        const st = selectedJob.status;
                        void (async () => {
                          setQueueBusy(`job-retry-${id}`);
                          setError(null);
                          setNotifyOk(null);
                          try {
                            const r =
                              st === "dead_letter"
                                ? await queueAdminDlqRequeue({ jobId: id })
                                : await queueAdminRetrySingleJob({ jobId: id });
                            if (!r.ok) {
                              setError(r.error);
                              return;
                            }
                            setNotifyOk("Sunucu onayı alındı.");
                            setSelectedJob(null);
                            await load();
                          } finally {
                            setQueueBusy(null);
                          }
                        })();
                      }}
                      className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 text-[9px] font-black uppercase tracking-widest text-emerald-200 disabled:opacity-40"
                    >
                      <RotateCcw size={12} aria-hidden />
                      Retry / DLQ geri al
                    </button>
                  )}
                  {selectedJob.status === "queued" && (
                    <button
                      type="button"
                      disabled={!!queueBusy}
                      onClick={() => {
                        const id = selectedJob.id;
                        void (async () => {
                          setQueueBusy(`job-cancel-${id}`);
                          setError(null);
                          setNotifyOk(null);
                          try {
                            const r = await queueAdminCancelQueuedJob({ jobId: id });
                            if (!r.ok) {
                              setError(r.error);
                              return;
                            }
                            setNotifyOk("Sunucu onayı alındı.");
                            setSelectedJob(null);
                            await load();
                          } finally {
                            setQueueBusy(null);
                          }
                        })();
                      }}
                      className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 text-[9px] font-black uppercase tracking-widest text-red-200 disabled:opacity-40"
                    >
                      Kuyruktan iptal
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <p className="text-[9px] font-black uppercase tracking-widest text-gray-600 text-right">
            Snapshot: {formatDateTime(snapshot.generatedAt)}
          </p>
        </>
      )}
    </div>
  );
}
