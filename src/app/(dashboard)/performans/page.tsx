"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  TrendingUp,
  ChevronDown,
  Moon,
  Clock,
  ShieldCheck,
  Loader2,
  Zap,
  Waves,
  Siren,
} from "lucide-react";
import Link from "next/link";
import { listManagementDirectory } from "@/lib/actions/managementDirectoryActions";
import { listPerformanceAnalyticsData } from "@/lib/actions/performanceAnalyticsActions";
import type { AcwrPoint, AthleteOption, EwmaPoint, TrainingLoadRow, WellnessReportRow } from "@/types/performance";
import type { ReactNode } from "react";
import { profileRowIsActive } from "@/lib/coach/lifecycle";
import {
  computeRiskStats,
  emptyRiskStats,
  getLoadDate,
  processACWRData,
  processEWMAData,
} from "@/lib/performance/loadSeries";

const TEAM_VALUE = "";

export default function PerformanceAnalytics() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string>(TEAM_VALUE);
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [acwrData, setAcwrData] = useState<AcwrPoint[]>([]);
  const [ewmaData, setEwmaData] = useState<EwmaPoint[]>([]);
  const [wellnessReports, setWellnessReports] = useState<WellnessReportRow[]>([]);
  const [riskStats, setRiskStats] = useState(emptyRiskStats());
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setOrgLoading(true);
      const dir = await listManagementDirectory();
      if (cancelled) return;
      if ("error" in dir) {
        setLoadError(dir.error ?? "Organizasyon bilgisi alınamadı.");
        setOrgId(null);
        setAthletes([]);
      } else {
        setOrgId(dir.organizationId);
        setAthletes(
          dir.athletes
            .filter((a) => profileRowIsActive(a.is_active))
            .map((a) => ({ id: a.id, full_name: a.full_name }))
        );
        setLoadError(null);
      }
      setOrgLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const athleteId = selectedAthleteId === TEAM_VALUE ? null : selectedAthleteId;
      const result = await listPerformanceAnalyticsData(orgId, athleteId);
      if ("error" in result) {
        setLoadError(result.error ?? "Performans verisi alınamadı.");
        setAcwrData([]);
        setEwmaData([]);
        setWellnessReports([]);
        setRiskStats(emptyRiskStats());
        return;
      }

      const loads = (result.loads || []) as unknown as TrainingLoadRow[];
      const reports = (result.reports || []) as WellnessReportRow[];

      const normalized = [...loads].sort((a, b) => getLoadDate(a).getTime() - getLoadDate(b).getTime());
      setWellnessReports(reports);

      if (normalized.length > 0) {
        const acwrProcessed = processACWRData(normalized);
        const ewmaProcessed = processEWMAData(normalized);
        setAcwrData(acwrProcessed);
        setEwmaData(ewmaProcessed);
        setRiskStats(computeRiskStats(acwrProcessed, ewmaProcessed, normalized, reports));
      } else {
        setAcwrData([]);
        setEwmaData([]);
        setRiskStats(computeRiskStats([], [], [], reports));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "";
      if (message) {
        console.warn("Performans verisi uyarisi:", message);
        setLoadError(`Performans verisi alınamadı: ${message}`);
      }
    } finally {
      setLoading(false);
    }
  }, [orgId, selectedAthleteId]);

  useEffect(() => {
    if (orgId) void fetchData();
  }, [orgId, fetchData]);

  if (orgLoading || (loading && !orgId)) {
    return (
      <div className="flex min-h-[50dvh] min-w-0 flex-col items-center justify-center gap-4 overflow-x-hidden px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        <Loader2 className="animate-spin text-[#7c3aed]" size={48} aria-hidden />
        <p className="text-center text-[10px] font-black uppercase italic tracking-[0.2em] text-gray-600 sm:tracking-[0.3em]">Analiz Motoru Hazırlanıyor...</p>
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="flex min-h-[50dvh] min-w-0 flex-col items-center justify-center gap-4 overflow-x-hidden p-8 px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
        <p className="break-words text-center text-[10px] font-black uppercase tracking-widest text-red-400">{loadError || "Erişim sağlanamadı."}</p>
      </div>
    );
  }
  const performanceTabs = [
    { key: "yuk", label: "Yük Analizi", href: "/performans" },
    { key: "saha", label: "Saha Testleri", href: "/saha-testleri" },
    { key: "rapor", label: "İdman Raporu", href: "/idman-raporu" },
  ] as const;

  return (
    <div className="ui-page-loose min-w-0 overflow-x-hidden pb-[max(5rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex flex-col gap-6 md:flex-row md:justify-between md:items-end min-w-0">
        <div className="min-w-0">
          <h1 className="ui-h1">
            PERFORMANS <span className="text-[#7c3aed]">MERKEZİ</span>
          </h1>
          <p className="ui-lead break-words">
            Akut/Kronik Yük ve Sakatlık Önleme Paneli
          </p>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full md:w-auto shrink-0">
          <div className="relative w-full md:w-72 min-w-0">
            <select
              className="ui-select w-full min-h-11 bg-[#121215] border-white/5 px-5 rounded-2xl italic text-base sm:text-[10px] uppercase appearance-none cursor-pointer tracking-wide sm:tracking-widest shadow-xl touch-manipulation"
              onChange={(e) => setSelectedAthleteId(e.target.value)}
              value={selectedAthleteId}
            >
              <option value={TEAM_VALUE}>Takım Geneli</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-[#7c3aed]" aria-hidden />
          </div>
        </div>
      </header>
      <nav className="flex flex-wrap gap-2" aria-label="Performans alt gezinim">
        {performanceTabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={`inline-flex min-h-10 items-center rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-wide ${
              tab.href === "/performans"
                ? "border-[#7c3aed]/40 bg-[#7c3aed]/10 text-[#c4b5fd]"
                : "border-white/10 bg-white/[0.03] text-gray-300 hover:text-white"
            }`}
            aria-current={tab.href === "/performans" ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {loading && (
        <div className="flex min-w-0 items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
          <Loader2 className="animate-spin text-[#7c3aed]" size={16} aria-hidden />
          Veriler güncelleniyor...
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 min-w-0">
        <StatusCard
          label="Kritik Risk"
          value={riskStats.critical}
          unit="GÜN"
          color="red"
          icon={<AlertTriangle />}
          desc="Son 10 günde ACWR oranı >1,5 olan gün sayısı"
        />
        <StatusCard
          label="Sweet Spot"
          value={riskStats.sweetSpot}
          unit="GÜN"
          color="green"
          icon={<ShieldCheck />}
          desc="Son 10 günde 0,8–1,3 ACWR aralığındaki gün sayısı"
        />
        <StatusCard
          label="Ort. Seans RPE"
          value={riskStats.avgRpe}
          unit="/ 10"
          color="purple"
          icon={<Activity />}
          desc="Seçili kapsamdaki ortalama RPE"
        />
        <StatusCard
          label="EWMA Risk"
          value={riskStats.ewmaRisk}
          unit="GÜN"
          color="red"
          icon={<Waves />}
          desc="Son 10 günde EWMA oranı >1,5 olan gün sayısı"
        />
        <StatusCard
          label="Readiness"
          value={riskStats.readiness}
          unit="/100"
          color={riskStats.readiness >= 70 ? "green" : "red"}
          icon={<Moon />}
          desc="Son 7 wellness kaydına göre hazırlık skoru"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 min-w-0">
        <StatusCard
          label="Monotony"
          value={riskStats.monotony}
          unit=""
          color={riskStats.monotony >= 2 ? "red" : "purple"}
          icon={<TrendingUp />}
          desc="Son 7 gün: ortalama yük ÷ standart sapma (Banister monotonisi)"
        />
        <StatusCard
          label="Strain"
          value={riskStats.strain}
          unit="AU"
          color={riskStats.strain >= 3500 ? "red" : "green"}
          icon={<Zap />}
          desc="Haftalık yük × monotoni (yaklaşık strain)"
        />
      </div>

      {riskStats.highRiskStreak >= 3 && (
        <div className="ui-badge-danger !rounded-2xl !px-4 sm:!px-6 !py-4 !text-[9px] sm:!text-[10px] flex flex-wrap items-start gap-3 min-w-0">
          <Siren size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span className="break-words min-w-0">
            Son {riskStats.highRiskStreak} gün boyunca yüksek risk algılandı. Yüklemeyi azaltıp toparlanma protokolü uygulayın.
          </span>
        </div>
      )}

      {loadError && (
        <div className="ui-badge-danger !rounded-2xl !px-6 !py-4 !text-[10px] break-words min-w-0">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 min-w-0">
        <div className="lg:col-span-6 ui-card-chart group min-w-0 !p-5 sm:!p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-10 min-w-0">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] sm:tracking-[0.4em] flex flex-wrap items-center gap-2 sm:gap-3 italic min-w-0">
              <TrendingUp size={16} className="shrink-0 text-[#7c3aed]" aria-hidden /> <span className="break-words">Yük Dengesi Analizi</span>
            </h3>
            <div className="flex flex-wrap gap-2 sm:gap-4 text-[8px] font-black uppercase italic text-gray-600 tracking-wide sm:tracking-widest">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#7c3aed]" /> Akut (7G)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-700" /> Kronik (28G)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> ACWR
              </span>
            </div>
          </div>

          <div className="h-[260px] sm:h-[320px] lg:h-[400px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={acwrData}>
                <defs>
                  <linearGradient id="colorAkut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="date" stroke="#4b5563" fontSize={9} fontStyle="italic" axisLine={false} tickLine={false} />
                <YAxis
                  yAxisId="load"
                  stroke="#4b5563"
                  fontSize={9}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: "Yük (AU)", angle: -90, position: "insideLeft", fill: "#6b7280", fontSize: 9 }}
                />
                <YAxis
                  yAxisId="ratio"
                  orientation="right"
                  stroke="#f59e0b"
                  fontSize={9}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, "auto"]}
                  label={{ value: "ACWR", angle: 90, position: "insideRight", fill: "#f59e0b", fontSize: 9 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1c1c21",
                    border: "1px solid rgba(124, 58, 237, 0.2)",
                    borderRadius: "20px",
                    padding: "15px",
                  }}
                />
                <ReferenceLine
                  yAxisId="ratio"
                  y={1.5}
                  stroke="#ef4444"
                  strokeDasharray="8 8"
                  label={{ position: "right", value: "RİSK", fill: "#ef4444", fontSize: 10, fontWeight: "bold" }}
                />
                <Area
                  yAxisId="load"
                  type="monotone"
                  dataKey="akut"
                  stroke="#7c3aed"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorAkut)"
                />
                <Line yAxisId="load" type="monotone" dataKey="kronik" stroke="#374151" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                <Line yAxisId="ratio" type="monotone" dataKey="ratio" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-6 ui-card-chart group min-w-0 !p-5 sm:!p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-10 min-w-0">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] sm:tracking-[0.4em] flex flex-wrap items-center gap-2 sm:gap-3 italic min-w-0">
              <Waves size={16} className="shrink-0 text-[#7c3aed]" aria-hidden /> <span className="break-words">EWMA Yük Trendi</span>
            </h3>
            <div className="flex flex-wrap gap-2 sm:gap-4 text-[8px] font-black uppercase italic text-gray-600 tracking-wide sm:tracking-widest">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#7c3aed]" /> Acute EWMA
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-700" /> Chronic EWMA
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Oran
              </span>
            </div>
          </div>

          <div className="h-[260px] sm:h-[320px] lg:h-[400px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={ewmaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="date" stroke="#4b5563" fontSize={9} fontStyle="italic" axisLine={false} tickLine={false} />
                <YAxis
                  yAxisId="load"
                  stroke="#4b5563"
                  fontSize={9}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: "EWMA (AU)", angle: -90, position: "insideLeft", fill: "#6b7280", fontSize: 9 }}
                />
                <YAxis
                  yAxisId="ratio"
                  orientation="right"
                  stroke="#f59e0b"
                  fontSize={9}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, "auto"]}
                  label={{ value: "Oran", angle: 90, position: "insideRight", fill: "#f59e0b", fontSize: 9 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1c1c21",
                    border: "1px solid rgba(124, 58, 237, 0.2)",
                    borderRadius: "20px",
                    padding: "15px",
                  }}
                />
                <ReferenceLine
                  yAxisId="ratio"
                  y={1.5}
                  stroke="#ef4444"
                  strokeDasharray="8 8"
                  label={{ position: "right", value: "RİSK", fill: "#ef4444", fontSize: 10, fontWeight: "bold" }}
                />
                <Line yAxisId="load" type="monotone" dataKey="acuteEwma" stroke="#7c3aed" strokeWidth={3} dot={false} />
                <Line yAxisId="load" type="monotone" dataKey="chronicEwma" stroke="#374151" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                <Line yAxisId="ratio" type="monotone" dataKey="ewmaRatio" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-12 ui-card-chart flex flex-col min-w-0 !p-5 sm:!p-8">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] sm:tracking-[0.4em] mb-6 sm:mb-8 flex flex-wrap items-center gap-2 sm:gap-3 italic min-w-0">
            <Moon size={16} className="shrink-0 text-[#7c3aed]" aria-hidden /> <span className="break-words">Son Wellness Raporları</span>
          </h3>

          <div className="space-y-4 flex-1 overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar min-w-0">
            {wellnessReports.map((report) => {
              const prof = Array.isArray(report.profiles) ? report.profiles[0] : report.profiles;
              return (
                <div
                  key={report.id}
                  className="flex min-w-0 flex-col gap-3 rounded-[1.5rem] border border-white/5 bg-white/[0.02] p-4 transition-all sm:rounded-[2rem] sm:p-5 sm:hover:bg-[#7c3aed]/5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-black italic uppercase text-white tracking-tight break-words">{prof?.full_name}</p>
                    <p className="text-[8px] text-gray-500 font-bold uppercase mt-1 flex items-center gap-2 italic">
                      <Clock size={10} aria-hidden /> {new Date(report.report_date).toLocaleDateString("tr-TR")}
                    </p>
                  </div>
                  <div
                    className={`text-[9px] font-black py-2 px-3 rounded-xl border shrink-0 self-start sm:self-auto ${
                      (report.fatigue ?? 0) >= 4 ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-green-500/10 text-green-500 border-green-500/20"
                    }`}
                  >
                    {(report.fatigue ?? 0) >= 4 ? "YÜKSEK YORGUNLUK" : "NORMAL"}
                  </div>
                </div>
              );
            })}
            {wellnessReports.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-20 italic">
                <Zap size={40} className="mb-4" aria-hidden />
                <p className="text-[10px] uppercase font-black tracking-widest text-center">Veri bekleniyor...</p>
              </div>
            )}
          </div>

          <Link
            href="/performans/wellness-detay"
            className="mt-6 block min-h-12 w-full touch-manipulation rounded-2xl border border-white/5 bg-[#1c1c21] py-4 text-center text-[9px] font-black uppercase tracking-[0.2em] text-gray-500 transition-all sm:mt-8 sm:py-5 sm:tracking-[0.3em] sm:hover:text-[#7c3aed]"
          >
            ARŞİVİ GÖRÜNTÜLE →
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatusCard({
  label,
  value,
  unit,
  color,
  icon,
  desc,
}: {
  label: string;
  value: string | number;
  unit: string;
  color: "red" | "green" | "purple";
  icon: ReactNode;
  desc: string;
}) {
  const colorMap: Record<"red" | "green" | "purple", string> = {
    red: "text-red-500 border-red-500/10 bg-red-500/[0.02]",
    green: "text-green-500 border-green-500/10 bg-green-500/[0.02]",
    purple: "text-[#7c3aed] border-[#7c3aed]/10 bg-[#7c3aed]/[0.02]",
  };

  return (
    <div
      className={`bg-[#121215] border ${colorMap[color]} p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] relative group shadow-2xl transition-all sm:hover:scale-[1.02] min-w-0`}
    >
      <div className="flex justify-between items-start gap-3 mb-4 sm:mb-6 min-w-0">
        <span className="ui-label text-gray-500 break-words min-w-0">{label}</span>
        <div className="shrink-0 rounded-2xl bg-white/5 p-2 shadow-inner transition-all sm:group-hover:bg-[#7c3aed] sm:group-hover:text-white sm:p-3">
          {icon}
        </div>
      </div>
      <h2 className="text-4xl sm:text-5xl md:text-6xl font-black italic text-white tracking-tighter leading-none break-words">
        {value}{" "}
        <span className="text-xs not-italic text-gray-600 uppercase tracking-widest ml-1">{unit}</span>
      </h2>
      <p className="text-[9px] font-black mt-4 sm:mt-6 uppercase italic text-gray-600 tracking-[0.15em] sm:tracking-[0.2em] break-words">{desc}</p>
    </div>
  );
}
