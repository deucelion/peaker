"use client";

import { useMemo } from "react";
import { Activity, Database, Radio, Server, AlertTriangle, Gauge } from "lucide-react";
import type { SystemOperationsSnapshot } from "@/lib/actions/systemOperationsTypes";
import { getRealtimeHealthSummary } from "@/lib/realtime/clientRealtimeStats";
import { computeProductionHealthScores, type HealthScoreBundle } from "@/lib/ops/systemHealthScore";
import { validateProductionEnv } from "@/lib/ops/envValidation";

function scoreTone(score: number): string {
  if (score >= 75) return "text-emerald-300 border-emerald-500/30 bg-emerald-500/10";
  if (score >= 50) return "text-amber-200 border-amber-500/30 bg-amber-500/10";
  return "text-rose-300 border-rose-500/30 bg-rose-500/10";
}

function ScoreCard({ label, score, icon }: { label: string; score: number; icon: React.ReactNode }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${scoreTone(score)}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wide">
          {icon}
          {label}
        </span>
        <span className="text-lg font-black tabular-nums">{score}</span>
      </div>
    </div>
  );
}

export function ProductionHealthOverview({ snapshot }: { snapshot: SystemOperationsSnapshot }) {
  const realtime = getRealtimeHealthSummary();
  const scores: HealthScoreBundle = useMemo(
    () => computeProductionHealthScores(snapshot, realtime.counters),
    [snapshot, realtime.counters]
  );
  const envReport = useMemo(() => validateProductionEnv(), []);

  const labelTr =
    scores.label === "healthy" ? "Sağlıklı" : scores.label === "degraded" ? "Dikkat" : "Kritik";

  return (
    <section className="ui-kpi-chip--brand space-y-4 rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wide text-white">
            Production sağlık özeti
          </h2>
          <p className="mt-1 text-[10px] font-bold text-gray-500">
            Snapshot: {new Date(snapshot.generatedAt).toLocaleString("tr-TR")}
          </p>
        </div>
        <div className={`rounded-xl border px-4 py-2 text-center ${scoreTone(scores.overall)}`}>
          <p className="text-[9px] font-black uppercase">Genel skor</p>
          <p className="text-2xl font-black tabular-nums">{scores.overall}</p>
          <p className="text-[9px] font-bold uppercase">{labelTr}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <ScoreCard label="Kuyruk" score={scores.queue} icon={<Database size={12} aria-hidden />} />
        <ScoreCard label="Worker" score={scores.worker} icon={<Server size={12} aria-hidden />} />
        <ScoreCard label="Realtime" score={scores.realtime} icon={<Radio size={12} aria-hidden />} />
        <ScoreCard label="Export" score={scores.exports} icon={<Activity size={12} aria-hidden />} />
        <ScoreCard label="Şema/MV" score={scores.schema} icon={<Gauge size={12} aria-hidden />} />
        <ScoreCard
          label="Uyarı"
          score={Math.max(0, 100 - snapshot.openOperationalAlertsCount * 8)}
          icon={<AlertTriangle size={12} aria-hidden />}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="ui-card-inner p-3">
          <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-gray-500">
            Bu oturum — realtime (istemci)
          </p>
          <ul className="space-y-1 text-[10px] font-bold text-gray-400">
            <li>
              Kanal abonelik:{" "}
              <span className="text-white tabular-nums">{realtime.counters.channelSubscribed}</span>
            </li>
            <li>
              Reconnect:{" "}
              <span className="text-white tabular-nums">{realtime.counters.reconnectNoted}</span>
              {realtime.reconnectStorm ? (
                <span className="ml-2 text-amber-300">(fırtına riski)</span>
              ) : null}
            </li>
            <li>
              Başarısız abonelik:{" "}
              <span className="text-white tabular-nums">{realtime.counters.failedSubscription}</span>
            </li>
            <li>
              Cross-tab sync:{" "}
              <span className="text-white tabular-nums">{realtime.counters.financeCrossTab}</span>
            </li>
          </ul>
        </div>

        <div className="ui-card-inner p-3">
          <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-gray-500">
            Ortam doğrulama (sunucu)
          </p>
          {envReport.checks
            .filter((c) => c.severity === "required" || !c.ok)
            .slice(0, 6)
            .map((c) => (
              <p key={c.key} className="text-[10px] font-bold text-gray-400">
                {c.ok ? "✓" : "✗"} {c.key}
              </p>
            ))}
          <p className="mt-2 text-[9px] text-gray-600">
            {envReport.ok ? "Zorunlu ENV tamam." : `Eksik: ${envReport.missingRequired.join(", ")}`}
          </p>
        </div>
      </div>
    </section>
  );
}
