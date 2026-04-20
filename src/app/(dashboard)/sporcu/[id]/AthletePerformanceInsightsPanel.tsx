"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  LineChart,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Heart,
  LayoutGrid,
  LineChart as LineChartIcon,
  Moon,
  ShieldCheck,
  Siren,
  Table2,
  TrendingUp,
  Waves,
  Zap,
} from "lucide-react";
import type { TrainingLoadRow, WellnessReportRow } from "@/types/performance";
import {
  computeRiskStats,
  getLoadDate,
  getReadinessScore,
  processACWRData,
  processEWMAData,
} from "@/lib/performance/loadSeries";

export type BodyMetricRow = {
  measurement_date: string;
  weight: number | null;
  body_fat: number | null;
};

type Visibility = {
  summary: boolean;
  acwr: boolean;
  ewma: boolean;
  loads: boolean;
  wellness: boolean;
  body: boolean;
};

const defaultVis: Visibility = {
  summary: true,
  acwr: true,
  ewma: true,
  loads: true,
  wellness: true,
  body: true,
};

export function AthletePerformanceInsightsPanel({
  loads,
  wellnessReports,
  bodyMetrics,
}: {
  loads: TrainingLoadRow[];
  wellnessReports: WellnessReportRow[];
  bodyMetrics: BodyMetricRow[];
}) {
  const [vis, setVis] = useState<Visibility>(defaultVis);
  const [view, setView] = useState<"grafik" | "tablo">("grafik");

  const normalizedLoads = useMemo(
    () => [...loads].sort((a, b) => getLoadDate(a).getTime() - getLoadDate(b).getTime()),
    [loads]
  );

  const acwrData = useMemo(
    () => (normalizedLoads.length ? processACWRData(normalizedLoads) : []),
    [normalizedLoads]
  );
  const ewmaData = useMemo(
    () => (normalizedLoads.length ? processEWMAData(normalizedLoads) : []),
    [normalizedLoads]
  );
  const riskStats = useMemo(
    () =>
      computeRiskStats(acwrData, ewmaData, normalizedLoads, wellnessReports),
    [acwrData, ewmaData, normalizedLoads, wellnessReports]
  );

  const toggle = (k: keyof Visibility) => setVis((v) => ({ ...v, [k]: !v[k] }));

  const loadTableColCount = 1 + (vis.loads ? 2 : 0) + (vis.acwr ? 1 : 0) + (vis.ewma ? 1 : 0);

  const pill = (key: keyof Visibility, label: string) => (
    <button
      type="button"
      onClick={() => toggle(key)}
      className={`min-h-11 touch-manipulation rounded-xl border px-3 py-2 text-[8px] font-black uppercase tracking-widest transition-all ${
        vis[key]
          ? "bg-[#7c3aed]/20 border-[#7c3aed]/40 text-white"
          : "bg-black/40 border-white/10 text-gray-600 line-through"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      id="performans-analitigi"
      className="bg-[#121215] border border-white/5 rounded-2xl md:rounded-3xl p-5 md:p-7 shadow-xl space-y-6 md:space-y-7 min-w-0 overflow-x-hidden"
    >
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6 xl:gap-8 min-w-0">
        <div className="flex items-start gap-4 min-w-0">
          <div className="shrink-0 rounded-xl bg-[#7c3aed]/10 p-2 text-[#7c3aed]">
            <BarChart3 size={18} aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm md:text-base font-black italic text-white uppercase tracking-tight break-words">
              Performans <span className="text-[#7c3aed]">Analitiği</span>
            </h3>
            <p className="text-[8px] font-black text-gray-600 uppercase tracking-[0.2em] sm:tracking-[0.3em] mt-1 italic leading-relaxed break-words">
              ACWR · EWMA · yük · wellness — Performans Merkezi ile aynı hesap mantığı
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center shrink-0">
          <span className="text-[8px] font-black uppercase text-gray-600 tracking-widest">Görünüm</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setView("grafik")}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-[8px] font-black uppercase tracking-widest touch-manipulation ${
                view === "grafik" ? "bg-[#7c3aed] border-[#7c3aed] text-white" : "bg-black/40 border-white/10 text-gray-500"
              }`}
            >
              <LineChartIcon size={12} aria-hidden /> Grafik
            </button>
            <button
              type="button"
              onClick={() => setView("tablo")}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-[8px] font-black uppercase tracking-widest touch-manipulation ${
                view === "tablo" ? "bg-[#7c3aed] border-[#7c3aed] text-white" : "bg-black/40 border-white/10 text-gray-500"
              }`}
            >
              <Table2 size={12} aria-hidden /> Sayısal
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[8px] font-black uppercase tracking-widest text-gray-600 flex items-center gap-2">
          <LayoutGrid size={12} className="text-[#7c3aed]" aria-hidden /> Koç: gösterilecek bloklar
        </p>
        <div className="flex flex-wrap gap-2">
          {pill("summary", "Özet KPI")}
          {pill("acwr", "ACWR")}
          {pill("ewma", "EWMA")}
          {pill("loads", "Ham yük / RPE")}
          {pill("wellness", "Wellness")}
          {pill("body", "Kilo / yağ")}
        </div>
      </div>

      {vis.summary && riskStats.highRiskStreak >= 3 && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 sm:px-6 py-4 rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-wide sm:tracking-widest italic flex flex-wrap items-start gap-3 min-w-0">
          <Siren size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span className="break-words min-w-0">
            Son {riskStats.highRiskStreak} gün yüksek yük riski (ACWR/EWMA). Yüklemeyi gözden geçirin.
          </span>
        </div>
      )}

      {vis.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2 sm:gap-3 min-w-0">
          <MiniKpi icon={<AlertTriangle size={14} />} label="Kritik gün" value={riskStats.critical} sub="10g ACWR&gt;1.5" tone="red" />
          <MiniKpi icon={<ShieldCheck size={14} />} label="Sweet spot" value={riskStats.sweetSpot} sub="10g 0.8–1.3" tone="green" />
          <MiniKpi icon={<Activity size={14} />} label="Ort. RPE" value={riskStats.avgRpe} sub="/10" tone="purple" />
          <MiniKpi icon={<Waves size={14} />} label="EWMA risk" value={riskStats.ewmaRisk} sub="10g &gt;1.5" tone="red" />
          <MiniKpi icon={<Moon size={14} />} label="Readiness" value={riskStats.readiness} sub="/100" tone="purple" />
          <MiniKpi icon={<TrendingUp size={14} />} label="Monotoni" value={riskStats.monotony} sub="Son 7g" tone="purple" />
          <MiniKpi icon={<Zap size={14} />} label="Strain" value={riskStats.strain} sub="AU" tone="purple" />
        </div>
      )}

      {(vis.acwr || vis.ewma) && view === "grafik" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-8 min-w-0">
          {vis.acwr && (
            <div className="bg-black/30 border border-white/5 rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-8 min-w-0">
              <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-6 flex items-center gap-2 italic">
                <TrendingUp size={14} className="text-[#7c3aed]" /> ACWR
              </h4>
              <div className="h-[240px] sm:h-[280px] lg:h-[300px] w-full min-w-0">
                {acwrData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={acwrData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 8 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="load" tick={{ fill: "#6b7280", fontSize: 8 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="ratio" orientation="right" tick={{ fill: "#f59e0b", fontSize: 8 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1c1c21",
                          border: "1px solid rgba(124,58,237,0.2)",
                          borderRadius: "12px",
                          fontSize: "10px",
                        }}
                      />
                      <ReferenceLine yAxisId="ratio" y={1.5} stroke="#ef4444" strokeDasharray="4 4" />
                      <defs>
                        <linearGradient id="spAcwrAkut" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area yAxisId="load" type="monotone" dataKey="akut" stroke="#7c3aed" fill="url(#spAcwrAkut)" strokeWidth={2} />
                      <Line yAxisId="load" type="monotone" dataKey="kronik" stroke="#4b5563" strokeWidth={1} strokeDasharray="4 4" dot={false} />
                      <Line yAxisId="ratio" type="monotone" dataKey="ratio" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyBlock />
                )}
              </div>
            </div>
          )}
          {vis.ewma && (
            <div className="bg-black/30 border border-white/5 rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-8 min-w-0">
              <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-6 flex items-center gap-2 italic">
                <Waves size={14} className="text-[#7c3aed]" /> EWMA
              </h4>
              <div className="h-[240px] sm:h-[280px] lg:h-[300px] w-full min-w-0">
                {ewmaData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={ewmaData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 8 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="load" tick={{ fill: "#6b7280", fontSize: 8 }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="ratio" orientation="right" tick={{ fill: "#f59e0b", fontSize: 8 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1c1c21",
                          border: "1px solid rgba(124,58,237,0.2)",
                          borderRadius: "12px",
                          fontSize: "10px",
                        }}
                      />
                      <ReferenceLine yAxisId="ratio" y={1.5} stroke="#ef4444" strokeDasharray="4 4" />
                      <Line yAxisId="load" type="monotone" dataKey="acuteEwma" stroke="#7c3aed" strokeWidth={2} dot={false} />
                      <Line yAxisId="load" type="monotone" dataKey="chronicEwma" stroke="#4b5563" strokeWidth={1} strokeDasharray="4 4" dot={false} />
                      <Line yAxisId="ratio" type="monotone" dataKey="ewmaRatio" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyBlock />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {(vis.acwr || vis.ewma || vis.loads) && view === "tablo" && (
        <div className="overflow-x-auto rounded-[2rem] border border-white/5">
          <table className="w-full text-left text-xs min-w-[640px]">
            <thead>
              <tr className="border-b border-white/10 text-[8px] font-black uppercase tracking-widest text-gray-500 bg-black/40">
                <th className="p-4">Tarih</th>
                {vis.loads && (
                  <>
                    <th className="p-4">Yük (AU)</th>
                    <th className="p-4">RPE</th>
                  </>
                )}
                {vis.acwr && <th className="p-4">ACWR</th>}
                {vis.ewma && <th className="p-4">EWMA oran</th>}
              </tr>
            </thead>
            <tbody>
              {normalizedLoads.length === 0 ? (
                <tr>
                  <td
                    colSpan={Math.max(loadTableColCount, 1)}
                    className="p-12 text-center text-gray-600 font-black uppercase text-[9px] tracking-widest"
                  >
                    Antrenman yükü kaydı yok
                  </td>
                </tr>
              ) : (
                normalizedLoads.map((row, i) => (
                  <tr key={`${row.measurement_date}-${i}`} className="border-b border-white/5 text-white font-bold">
                    <td className="p-4 tabular-nums">{getLoadDate(row).toLocaleDateString("tr-TR")}</td>
                    {vis.loads && (
                      <>
                        <td className="p-4 tabular-nums">{row.total_load ?? "—"}</td>
                        <td className="p-4 tabular-nums">{row.rpe_score ?? "—"}</td>
                      </>
                    )}
                    {vis.acwr && <td className="p-4 tabular-nums">{acwrData[i]?.ratio ?? "—"}</td>}
                    {vis.ewma && <td className="p-4 tabular-nums">{ewmaData[i]?.ewmaRatio ?? "—"}</td>}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {vis.loads && view === "grafik" && (
        <div className="bg-black/30 border border-white/5 rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-8 min-w-0">
          <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-6 italic">Günlük toplam yük</h4>
          <div className="h-[200px] sm:h-[240px] w-full min-w-0">
            {normalizedLoads.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={normalizedLoads.map((l) => ({
                    d: getLoadDate(l).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }),
                    yuk: l.total_load || 0,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                  <XAxis dataKey="d" tick={{ fill: "#6b7280", fontSize: 8 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 8 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1c1c21",
                      border: "1px solid rgba(124,58,237,0.2)",
                      borderRadius: "12px",
                      fontSize: "10px",
                    }}
                  />
                  <Line type="monotone" dataKey="yuk" stroke="#7c3aed" strokeWidth={3} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyBlock />
            )}
          </div>
        </div>
      )}

      {vis.wellness && wellnessReports.length > 0 && (
        <div className="bg-black/30 border border-white/5 rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-8 overflow-x-auto min-w-0">
          <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-4 flex items-center gap-2 italic">
            <Heart size={14} className="text-[#7c3aed]" /> Wellness
          </h4>
          {view === "tablo" ? (
            <table className="w-full text-left text-[11px] min-w-[720px]">
              <thead>
                <tr className="border-b border-white/10 text-[8px] font-black uppercase text-gray-500">
                  <th className="py-2 pr-3">Tarih</th>
                  <th className="py-2 pr-3">Skor</th>
                  <th className="py-2 pr-3">Uyku</th>
                  <th className="py-2 pr-3">Enerji</th>
                  <th className="py-2 pr-3">Stres</th>
                  <th className="py-2 pr-3">Yorgunluk</th>
                  <th className="py-2 pr-3">Ağrı</th>
                  <th className="py-2">Nabız</th>
                </tr>
              </thead>
              <tbody>
                {wellnessReports.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 text-gray-200">
                    <td className="py-3 pr-3 font-black">{new Date(r.report_date).toLocaleDateString("tr-TR")}</td>
                    <td className="py-3 pr-3 text-[#7c3aed] font-black">{getReadinessScore(r)}</td>
                    <td className="py-3 pr-3">{r.sleep_quality ?? "—"}</td>
                    <td className="py-3 pr-3">{r.energy_level ?? "—"}</td>
                    <td className="py-3 pr-3">{r.stress_level ?? "—"}</td>
                    <td className="py-3 pr-3">{r.fatigue ?? "—"}</td>
                    <td className="py-3 pr-3">{r.muscle_soreness ?? "—"}</td>
                    <td className="py-3">{r.resting_heart_rate ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={[...wellnessReports]
                    .sort((a, b) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime())
                    .map((r) => ({
                      d: new Date(r.report_date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }),
                      skor: getReadinessScore(r),
                    }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                  <XAxis dataKey="d" tick={{ fill: "#6b7280", fontSize: 8 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#6b7280", fontSize: 8 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "#1c1c21", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "12px" }} />
                  <Line type="monotone" dataKey="skor" stroke="#7c3aed" strokeWidth={2} dot={{ r: 2 }} name="Hazırlık" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {vis.body && bodyMetrics.length > 0 && (
        <div className="bg-black/30 border border-white/5 rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-8 overflow-x-auto min-w-0">
          <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-500 mb-4 italic">Vücut kompozisyonu</h4>
          {view === "tablo" ? (
            <table className="w-full text-left text-sm max-w-lg">
              <thead>
                <tr className="border-b border-white/10 text-[8px] font-black uppercase text-gray-500">
                  <th className="py-2 pr-4">Tarih</th>
                  <th className="py-2 pr-4">Kilo (kg)</th>
                  <th className="py-2">Yağ %</th>
                </tr>
              </thead>
              <tbody>
                {bodyMetrics.map((b, i) => (
                  <tr key={`${b.measurement_date}-${i}`} className="border-b border-white/5 text-white font-bold">
                    <td className="py-3 pr-4">{new Date(b.measurement_date).toLocaleDateString("tr-TR")}</td>
                    <td className="py-3 pr-4 tabular-nums">{b.weight ?? "—"}</td>
                    <td className="py-3 tabular-nums">{b.body_fat ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={bodyMetrics.map((b) => ({
                    d: new Date(b.measurement_date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }),
                    kilo: b.weight ?? 0,
                    yag: b.body_fat ?? 0,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                  <XAxis dataKey="d" tick={{ fill: "#6b7280", fontSize: 8 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 8 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "#1c1c21", border: "1px solid rgba(124,58,237,0.2)", borderRadius: "12px" }} />
                  <Line type="monotone" dataKey="kilo" stroke="#7c3aed" strokeWidth={2} dot={{ r: 2 }} name="Kilo" />
                  <Line type="monotone" dataKey="yag" stroke="#22d3ee" strokeWidth={2} dot={{ r: 2 }} name="Yağ %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MiniKpi({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  sub: string;
  tone: "red" | "green" | "purple";
}) {
  const ring =
    tone === "red"
      ? "border-red-500/20 bg-red-500/[0.04]"
      : tone === "green"
        ? "border-emerald-500/20 bg-emerald-500/[0.04]"
        : "border-[#7c3aed]/20 bg-[#7c3aed]/[0.06]";
  return (
    <div className={`rounded-2xl border p-3 sm:p-4 min-w-0 ${ring}`}>
      <div className="flex items-start justify-between gap-2 mb-2 text-gray-500 min-w-0">
        <span className="text-[7px] font-black uppercase tracking-wider sm:tracking-widest break-words min-w-0">{label}</span>
        <span className="shrink-0">{icon}</span>
      </div>
      <div className="text-base sm:text-lg md:text-xl font-black italic text-white leading-none break-words">{value}</div>
      <div className="text-[7px] font-black uppercase text-gray-600 mt-2 tracking-wider break-words">{sub}</div>
    </div>
  );
}

function EmptyBlock() {
  return (
    <div className="h-full flex items-center justify-center text-[9px] font-black uppercase tracking-widest text-gray-600 italic">
      Veri yok
    </div>
  );
}
