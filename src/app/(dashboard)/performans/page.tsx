"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ReferenceLine,
  ReferenceArea,
  Area,
  ComposedChart,
} from "recharts";
import {
  Activity,
  TrendingUp,
  ChevronDown,
  Moon,
  Clock,
  ShieldCheck,
  Loader2,
  Zap,
  Waves,
  Siren,
  RotateCcw,
  CalendarRange,
  Info,
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
  filterAcwrPointsByIstanbulInclusiveRange,
  filterEwmaPointsByIstanbulInclusiveRange,
  filterTrainingLoadsByIstanbulInclusiveRange,
  getLoadDate,
  getReadinessScore,
  processACWRData,
  processEWMAData,
} from "@/lib/performance/loadSeries";
import { istanbulLastNDaysInclusive } from "@/lib/performance/performanceDateRange";
import {
  buildKpiNarratives,
  deriveOverallPerformanceDecision,
  derivePerformanceRecommendations,
  type OverallPerformanceDecision,
} from "@/lib/performance/performanceDecision";

const TEAM_VALUE = "";

type RangeMode = "preset" | "custom";
type PresetKey = "7" | "14" | "28" | "90";

function formatTrRangeLabel(fromKey: string, toKey: string): string {
  const a = new Date(`${fromKey}T12:00:00Z`);
  const b = new Date(`${toKey}T12:00:00Z`);
  const o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  return `${a.toLocaleDateString("tr-TR", o)} – ${b.toLocaleDateString("tr-TR", o)}`;
}

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
  const [filterFeedback, setFilterFeedback] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);

  const default28 = useMemo(() => istanbulLastNDaysInclusive(28), []);

  const [rangeMode, setRangeMode] = useState<RangeMode>("preset");
  const [draftPreset, setDraftPreset] = useState<PresetKey>("28");
  const [draftFrom, setDraftFrom] = useState(default28.from);
  const [draftTo, setDraftTo] = useState(default28.to);
  const [appliedFrom, setAppliedFrom] = useState(default28.from);
  const [appliedTo, setAppliedTo] = useState(default28.to);
  const [appliedPreset, setAppliedPreset] = useState<PresetKey | null>("28");

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
        const d = istanbulLastNDaysInclusive(28);
        setDraftFrom(d.from);
        setDraftTo(d.to);
        setAppliedFrom(d.from);
        setAppliedTo(d.to);
        setAppliedPreset("28");
        setDraftPreset("28");
        setRangeMode("preset");
      }
      setOrgLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchData = useCallback(async () => {
    if (!orgId || !appliedFrom || !appliedTo) return;
    setLoading(true);
    setLoadError(null);
    try {
      const athleteId = selectedAthleteId === TEAM_VALUE ? null : selectedAthleteId;
      const result = await listPerformanceAnalyticsData(orgId, athleteId, {
        dateFrom: appliedFrom,
        dateTo: appliedTo,
      });
      if ("error" in result) {
        setLoadError(result.error ?? "Performans verisi alınamadı.");
        setAcwrData([]);
        setEwmaData([]);
        setWellnessReports([]);
        setRiskStats(emptyRiskStats());
        return;
      }

      const range = result.appliedRange ?? { dateFrom: appliedFrom, dateTo: appliedTo };
      const loads = (result.loads || []) as unknown as TrainingLoadRow[];
      const reports = (result.reports || []) as WellnessReportRow[];

      const extended = [...loads].sort((a, b) => getLoadDate(a).getTime() - getLoadDate(b).getTime());
      const displayLoads = filterTrainingLoadsByIstanbulInclusiveRange(extended, range.dateFrom, range.dateTo);
      setWellnessReports(reports);

      if (extended.length > 0) {
        const acwrFull = processACWRData(extended);
        const ewmaFull = processEWMAData(extended);
        const acwrDisplay = filterAcwrPointsByIstanbulInclusiveRange(acwrFull, range.dateFrom, range.dateTo);
        const ewmaDisplay = filterEwmaPointsByIstanbulInclusiveRange(ewmaFull, range.dateFrom, range.dateTo);
        setAcwrData(acwrDisplay);
        setEwmaData(ewmaDisplay);
        setRiskStats(computeRiskStats(acwrDisplay, ewmaDisplay, displayLoads, reports));
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
  }, [orgId, selectedAthleteId, appliedFrom, appliedTo]);

  useEffect(() => {
    if (orgId) void fetchData();
  }, [orgId, fetchData]);

  const applyFilters = useCallback(() => {
    setFilterError(null);
    if (rangeMode === "custom") {
      if (!draftFrom || !draftTo) {
        setFilterError("Baslangic ve bitis tarihlerini secin.");
        return;
      }
      if (draftFrom > draftTo) {
        setFilterError("Baslangic, bitisten sonra olamaz.");
        return;
      }
      setAppliedFrom(draftFrom);
      setAppliedTo(draftTo);
      setAppliedPreset(null);
    } else {
      const n =
        draftPreset === "7" ? 7 : draftPreset === "14" ? 14 : draftPreset === "90" ? 90 : 28;
      const { from, to } = istanbulLastNDaysInclusive(n);
      setAppliedFrom(from);
      setAppliedTo(to);
      setDraftFrom(from);
      setDraftTo(to);
      setAppliedPreset(draftPreset);
    }
    setFilterFeedback("Filtreler uygulandı");
    window.setTimeout(() => setFilterFeedback(null), 2800);
  }, [rangeMode, draftFrom, draftTo, draftPreset]);

  const resetFilters = useCallback(() => {
    const { from, to } = istanbulLastNDaysInclusive(28);
    setRangeMode("preset");
    setDraftPreset("28");
    setDraftFrom(from);
    setDraftTo(to);
    setAppliedFrom(from);
    setAppliedTo(to);
    setAppliedPreset("28");
    setFilterError(null);
    setFilterFeedback(null);
  }, []);

  const periodBadge = useMemo(() => {
    if (appliedPreset) {
      const map: Record<PresetKey, string> = {
        "7": "Son 7 gün",
        "14": "Son 14 gün",
        "28": "Son 28 gün",
        "90": "Son 90 gün",
      };
      return map[appliedPreset] ?? formatTrRangeLabel(appliedFrom, appliedTo);
    }
    return formatTrRangeLabel(appliedFrom, appliedTo);
  }, [appliedPreset, appliedFrom, appliedTo]);

  const latestAcwrRatio = useMemo(() => {
    const r = acwrData.at(-1)?.ratio;
    return typeof r === "number" && Number.isFinite(r) ? r : null;
  }, [acwrData]);

  const latestEwmaRatio = useMemo(() => {
    const r = ewmaData.at(-1)?.ewmaRatio;
    return typeof r === "number" && Number.isFinite(r) ? r : null;
  }, [ewmaData]);

  const overallDecision = useMemo(
    () =>
      deriveOverallPerformanceDecision({
        loadKpisAvailable: acwrData.length > 0,
        readinessHasData: riskStats.readinessReportCount > 0,
        riskStats,
        latestAcwrRatio,
        latestEwmaRatio,
      }),
    [acwrData.length, riskStats, latestAcwrRatio, latestEwmaRatio]
  );

  const kpiNarratives = useMemo(
    () =>
      buildKpiNarratives({
        loadKpisAvailable: acwrData.length > 0,
        readinessHasData: riskStats.readinessReportCount > 0,
        riskStats,
        acwrSeries: acwrData,
        ewmaSeries: ewmaData,
      }),
    [acwrData, ewmaData, riskStats]
  );

  const performanceRecommendations = useMemo(
    () =>
      derivePerformanceRecommendations({
        loadKpisAvailable: acwrData.length > 0,
        readinessHasData: riskStats.readinessReportCount > 0,
        riskStats,
        latestAcwrRatio,
        latestEwmaRatio,
      }),
    [acwrData.length, riskStats, latestAcwrRatio, latestEwmaRatio]
  );

  const acwrRatioDomainMax = useMemo(() => {
    if (!acwrData.length) return 2;
    const m = Math.max(...acwrData.map((d) => d.ratio || 0), 1.6);
    return Math.min(Math.max(Math.ceil(m * 10) / 10, 1.8), 4);
  }, [acwrData]);

  const ewmaRatioDomainMax = useMemo(() => {
    if (!ewmaData.length) return 2;
    const m = Math.max(...ewmaData.map((d) => d.ewmaRatio || 0), 1.6);
    return Math.min(Math.max(Math.ceil(m * 10) / 10, 1.8), 4);
  }, [ewmaData]);

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

  const loadKpisAvailable = acwrData.length > 0;
  const readinessHasData = riskStats.readinessReportCount > 0;

  const performanceTabs = [
    { key: "yuk", label: "Yük Analizi", href: "/performans" },
    { key: "saha", label: "Saha Testleri", href: "/saha-testleri" },
    { key: "rapor", label: "İdman Raporu", href: "/idman-raporu" },
  ] as const;

  return (
    <div className="ui-page-loose min-w-0 overflow-x-hidden pb-[max(5rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-start min-w-0">
        <div className="min-w-0 space-y-2">
          <h1 className="ui-h1">
            Performans <span className="text-[#7c3aed]">Merkezi</span>
          </h1>
          <p className="ui-lead break-words text-gray-400">
            Karar desteği: risk, yük dengesi ve öneriler — Europe/Istanbul takvimine göre seçili dönem.
          </p>
          <p className="inline-flex flex-wrap items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-gray-400">
            <CalendarRange size={12} className="text-[#7c3aed] shrink-0" aria-hidden />
            <span className="text-white/90">{periodBadge}</span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0 lg:items-center">
          <div className="relative w-full sm:w-72 min-w-0">
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
          <button
            type="button"
            onClick={() => void fetchData()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:border-[#7c3aed]/40 hover:text-white touch-manipulation"
          >
            <Loader2 className={`size-3.5 shrink-0 ${loading ? "animate-spin text-[#7c3aed]" : "opacity-60"}`} aria-hidden />
            Yenile
          </button>
        </div>
      </header>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Performans alt gezinim">
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

      <section
        className="mt-5 rounded-2xl border border-white/8 bg-[#121215]/80 p-4 sm:p-5 space-y-4 min-w-0"
        aria-label="Dönem filtresi"
      >
        <div className="flex flex-wrap gap-2">
          <span className="w-full text-[8px] font-black uppercase tracking-widest text-gray-500 sm:w-auto sm:mr-2">Hızlı dönem</span>
          {(
            [
              { k: "7" as const, label: "Son 7 gün" },
              { k: "14" as const, label: "Son 14 gün" },
              { k: "28" as const, label: "Son 28 gün" },
              { k: "90" as const, label: "Son 90 gün" },
            ] as const
          ).map(({ k, label }) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setRangeMode("preset");
                setDraftPreset(k);
              }}
              className={`min-h-9 rounded-xl border px-3 py-1.5 text-[9px] font-black uppercase tracking-wide touch-manipulation ${
                rangeMode === "preset" && draftPreset === k
                  ? "border-[#7c3aed]/50 bg-[#7c3aed]/15 text-white"
                  : "border-white/10 bg-black/30 text-gray-500 hover:text-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setRangeMode("custom");
              setDraftFrom(appliedFrom);
              setDraftTo(appliedTo);
            }}
            className={`min-h-9 rounded-xl border px-3 py-1.5 text-[9px] font-black uppercase tracking-wide touch-manipulation ${
              rangeMode === "custom"
                ? "border-[#7c3aed]/50 bg-[#7c3aed]/15 text-white"
                : "border-white/10 bg-black/30 text-gray-500 hover:text-gray-300"
            }`}
          >
            Özel aralık
          </button>
        </div>

        {rangeMode === "custom" && (
          <div className="space-y-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="flex flex-col gap-1 text-[8px] font-black uppercase text-gray-500 tracking-widest min-w-[140px]">
                Başlangıç
                <input
                  type="date"
                  value={draftFrom}
                  onChange={(e) => setDraftFrom(e.target.value)}
                  className="min-h-10 rounded-xl border border-white/10 bg-black/40 px-3 text-xs text-white"
                />
              </label>
              <label className="flex flex-col gap-1 text-[8px] font-black uppercase text-gray-500 tracking-widest min-w-[140px]">
                Bitiş
                <input
                  type="date"
                  value={draftTo}
                  onChange={(e) => setDraftTo(e.target.value)}
                  className="min-h-10 rounded-xl border border-white/10 bg-black/40 px-3 text-xs text-white"
                />
              </label>
            </div>
            <p className="text-[9px] font-bold uppercase tracking-wide text-gray-600">
              Özel tarih aralığı seçildiğinde hızlı dönem dikkate alınmaz.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => applyFilters()}
            className="min-h-10 rounded-xl bg-[#7c3aed] px-5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-[#6d28d9] touch-manipulation"
          >
            Filtreleri uygula
          </button>
          <button
            type="button"
            onClick={() => resetFilters()}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-white touch-manipulation"
          >
            <RotateCcw size={14} aria-hidden />
            Sıfırla
          </button>
          {filterFeedback && (
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400/90">{filterFeedback}</span>
          )}
        </div>
        {filterError && <p className="text-[10px] font-bold text-red-400 uppercase tracking-wide">{filterError}</p>}
      </section>

      <div className="mt-4 min-w-0">
        <OverallStatusBar decision={overallDecision} />
      </div>

      {loading && (
        <div className="mt-4 flex min-w-0 items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
          <Loader2 className="animate-spin text-[#7c3aed]" size={16} aria-hidden />
          Veriler güncelleniyor...
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-2 sm:gap-3 min-w-0">
        <CompactKpi
          label="ACWR (son)"
          metricTooltip="Akut (7g ort. yük) ÷ kronik (28g ort. yük). 0,8–1,3 optimal; &gt;1,5 risk."
          primary={kpiNarratives.acwr.primary}
          unit=""
          statusLine={kpiNarratives.acwr.status}
          detail={[
            kpiNarratives.acwr.detail,
            loadKpisAvailable && riskStats.critical > 0 ? `${riskStats.critical} gün ACWR &gt; 1,5.` : "",
          ]
            .filter(Boolean)
            .join(" ")}
          narrativeTone={kpiNarratives.acwr.tone}
          icon={<TrendingUp size={14} aria-hidden />}
        />
        <CompactKpi
          label="Sweet spot"
          metricTooltip="ACWR 0,8–1,3 aralığındaki gün sayısı (seçili dönem)."
          primary={kpiNarratives.sweet.primary}
          unit="gün"
          statusLine={kpiNarratives.sweet.status}
          detail={kpiNarratives.sweet.detail}
          narrativeTone={kpiNarratives.sweet.tone}
          icon={<ShieldCheck size={14} aria-hidden />}
        />
        <CompactKpi
          label="Ort. RPE"
          metricTooltip="Seçili dönemde geçerli RPE ortalaması (1–10)."
          primary={kpiNarratives.rpe.primary}
          unit={loadKpisAvailable && riskStats.avgRpe != null ? "/10" : ""}
          statusLine={kpiNarratives.rpe.status}
          detail={kpiNarratives.rpe.detail}
          narrativeTone={kpiNarratives.rpe.tone}
          icon={<Activity size={14} aria-hidden />}
        />
        <CompactKpi
          label="EWMA (son)"
          metricTooltip="Kısa/uzun vadeli ağırlıklı yük oranı; &gt;1,5 risk. Ayrıca seçili dönemde EWMA oranı riskli gün: risk günü sayısı."
          primary={kpiNarratives.ewma.primary}
          unit=""
          statusLine={kpiNarratives.ewma.status}
          detail={[
            kpiNarratives.ewma.detail,
            loadKpisAvailable ? `${riskStats.ewmaRisk} gün EWMA oranı &gt; 1,5.` : "",
          ]
            .filter(Boolean)
            .join(" ")}
          narrativeTone={kpiNarratives.ewma.tone}
          icon={<Waves size={14} aria-hidden />}
        />
        <CompactKpi
          label="Readiness"
          metricTooltip="Wellness alt skorlarından türetilen hazırlık (en fazla 7 kayıt)."
          primary={kpiNarratives.readiness.primary}
          unit={readinessHasData ? "/100" : ""}
          statusLine={kpiNarratives.readiness.status}
          detail={kpiNarratives.readiness.detail}
          narrativeTone={kpiNarratives.readiness.tone}
          icon={<Moon size={14} aria-hidden />}
        />
        <CompactKpi
          label="Monotony"
          metricTooltip="Son 7 yük noktasında ortalama ÷ standart sapma; yüksek = antrenman çok tekrarlı (Banister tarzı)."
          primary={kpiNarratives.monotony.primary}
          unit=""
          statusLine={kpiNarratives.monotony.status}
          detail={kpiNarratives.monotony.detail}
          narrativeTone={kpiNarratives.monotony.tone}
          icon={<TrendingUp size={14} aria-hidden />}
        />
        <CompactKpi
          label="Strain"
          metricTooltip="Son 7 günlük toplam yük × monotoni; yüksek değer haftalık zorlanmayı gösterir."
          primary={kpiNarratives.strain.primary}
          unit={loadKpisAvailable && riskStats.strain != null ? "AU" : ""}
          statusLine={kpiNarratives.strain.status}
          detail={kpiNarratives.strain.detail}
          narrativeTone={kpiNarratives.strain.tone}
          icon={<Zap size={14} aria-hidden />}
        />
      </div>

      {loadKpisAvailable && riskStats.highRiskStreak >= 3 && (
        <div className="ui-badge-danger !rounded-2xl !px-4 sm:!px-6 !py-3 !text-[9px] sm:!text-[10px] flex flex-wrap items-start gap-3 min-w-0 mt-4">
          <Siren size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span className="break-words min-w-0">
            Seçili seride {riskStats.highRiskStreak} gün üst üste yüksek risk (ACWR/EWMA). Yüklemeyi gözden geçirin.
          </span>
        </div>
      )}

      {loadError && (
        <div className="ui-badge-danger !rounded-2xl !px-6 !py-4 !text-[10px] break-words min-w-0 mt-4">
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 min-w-0">
        <div className="lg:col-span-6 ui-card-chart group min-w-0 !p-5 sm:!p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-10 min-w-0">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] sm:tracking-[0.4em] flex flex-wrap items-center gap-2 sm:gap-3 italic min-w-0">
              <TrendingUp size={16} className="shrink-0 text-[#7c3aed]" aria-hidden /> <span className="break-words">Yük Dengesi Analizi</span>
            </h3>
            <div className="flex flex-col gap-1 text-[8px] font-black uppercase text-gray-600 tracking-wide sm:tracking-widest">
              <div className="flex flex-wrap gap-2 sm:gap-4 italic">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#7c3aed]" /> Akut (7G)
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-gray-700" /> Kronik (28G)
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> ACWR
                </span>
              </div>
              <span className="font-bold not-italic text-gray-500 normal-case tracking-normal">
                Bantlar: 0,8–1,3 optimal · 1,3–1,5 dikkat · &gt;1,5 risk
              </span>
            </div>
          </div>

          <div
            className={`w-full min-w-0 ${acwrData.length === 0 ? "min-h-[140px] sm:min-h-[160px]" : "h-[220px] sm:h-[280px] lg:h-[320px]"}`}
          >
            {acwrData.length === 0 ? (
              <ChartEmptyState message="Veri yok — idman raporu girildiğinde oluşur." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={acwrData}>
                  <defs>
                    <linearGradient id="colorAkut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <ReferenceArea yAxisId="ratio" y1={0.8} y2={1.3} fill="#22c55e" fillOpacity={0.1} />
                  <ReferenceArea yAxisId="ratio" y1={1.3} y2={1.5} fill="#eab308" fillOpacity={0.09} />
                  <ReferenceArea yAxisId="ratio" y1={1.5} y2={acwrRatioDomainMax} fill="#ef4444" fillOpacity={0.1} />
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
                    domain={[0, acwrRatioDomainMax]}
                    label={{ value: "ACWR", angle: 90, position: "insideRight", fill: "#f59e0b", fontSize: 9 }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => (
                      <AcwrChartTooltip
                        active={active}
                        payload={payload as unknown as ChartTipPayload[] | undefined}
                        label={label}
                      />
                    )}
                  />
                  <ReferenceLine yAxisId="ratio" y={0.8} stroke="#86efac" strokeDasharray="4 4" strokeOpacity={0.75} />
                  <ReferenceLine yAxisId="ratio" y={1.3} stroke="#fcd34d" strokeDasharray="4 4" strokeOpacity={0.85} />
                  <ReferenceLine
                    yAxisId="ratio"
                    y={1.5}
                    stroke="#f87171"
                    strokeDasharray="6 4"
                    label={{ position: "right", value: "1.5", fill: "#fca5a5", fontSize: 9 }}
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
            )}
          </div>
        </div>

        <div className="lg:col-span-6 ui-card-chart group min-w-0 !p-5 sm:!p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6 sm:mb-10 min-w-0">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] sm:tracking-[0.4em] flex flex-wrap items-center gap-2 sm:gap-3 italic min-w-0">
              <Waves size={16} className="shrink-0 text-[#7c3aed]" aria-hidden /> <span className="break-words">EWMA Yük Trendi</span>
            </h3>
            <div className="flex flex-col gap-1 text-[8px] font-black uppercase text-gray-600 tracking-wide sm:tracking-widest">
              <div className="flex flex-wrap gap-2 sm:gap-4 italic">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#7c3aed]" /> Acute EWMA
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-gray-700" /> Chronic EWMA
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> Oran
                </span>
              </div>
              <span className="font-bold not-italic text-gray-500 normal-case tracking-normal">
                Kırmızı alan: oran &gt;1,5 risk bölgesi
              </span>
            </div>
          </div>

          <div
            className={`w-full min-w-0 ${ewmaData.length === 0 ? "min-h-[140px] sm:min-h-[160px]" : "h-[220px] sm:h-[280px] lg:h-[320px]"}`}
          >
            {ewmaData.length === 0 ? (
              <ChartEmptyState message="Veri yok — idman raporu girildiğinde oluşur." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={ewmaData}>
                  <ReferenceArea yAxisId="ratio" y1={0.8} y2={1.3} fill="#22c55e" fillOpacity={0.08} />
                  <ReferenceArea yAxisId="ratio" y1={1.3} y2={1.5} fill="#eab308" fillOpacity={0.08} />
                  <ReferenceArea yAxisId="ratio" y1={1.5} y2={ewmaRatioDomainMax} fill="#ef4444" fillOpacity={0.14} />
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
                    domain={[0, ewmaRatioDomainMax]}
                    label={{ value: "Oran", angle: 90, position: "insideRight", fill: "#f59e0b", fontSize: 9 }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => (
                      <EwmaChartTooltip
                        active={active}
                        payload={payload as unknown as ChartTipPayload[] | undefined}
                        label={label}
                      />
                    )}
                  />
                  <ReferenceLine yAxisId="ratio" y={0.8} stroke="#86efac" strokeDasharray="4 4" strokeOpacity={0.7} />
                  <ReferenceLine yAxisId="ratio" y={1.3} stroke="#fcd34d" strokeDasharray="4 4" strokeOpacity={0.8} />
                  <ReferenceLine
                    yAxisId="ratio"
                    y={1.5}
                    stroke="#f87171"
                    strokeDasharray="6 4"
                    label={{ position: "right", value: "1.5 risk", fill: "#fca5a5", fontSize: 9 }}
                  />
                  <Line yAxisId="load" type="monotone" dataKey="acuteEwma" stroke="#7c3aed" strokeWidth={3} dot={false} />
                  <Line yAxisId="load" type="monotone" dataKey="chronicEwma" stroke="#374151" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  <Line yAxisId="ratio" type="monotone" dataKey="ewmaRatio" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="lg:col-span-12 ui-card-chart flex flex-col min-w-0 !p-5 sm:!p-8">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] sm:tracking-[0.4em] mb-6 sm:mb-8 flex flex-wrap items-center gap-2 sm:gap-3 italic min-w-0">
            <Moon size={16} className="shrink-0 text-[#7c3aed]" aria-hidden /> <span className="break-words">Son Wellness Raporları</span>
          </h3>

          <div className="space-y-4 flex-1 overflow-y-auto overflow-x-hidden pr-2 custom-scrollbar min-w-0">
            {wellnessReports.map((report) => {
              const prof = Array.isArray(report.profiles) ? report.profiles[0] : report.profiles;
              const dayScore = getReadinessScore(report);
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
                    <p className="text-[8px] text-gray-600 font-bold uppercase mt-1 tracking-wide tabular-nums">
                      Readiness {dayScore}/100
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
              <div className="flex min-h-[100px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 px-3 py-6 text-center">
                <Moon size={22} className="text-gray-600" aria-hidden />
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Bu dönemde wellness raporu yok</p>
                <p className="text-[8px] font-bold text-gray-600 max-w-md leading-relaxed">
                  Sabah raporu girildiğinde liste ve readiness güncellenir.
                </p>
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

      <section
        className="mt-6 rounded-2xl border border-white/10 bg-[#121215]/90 p-4 sm:p-5 min-w-0"
        aria-label="Öneriler"
      >
        <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-500 mb-3 flex items-center gap-2">
          <Activity size={14} className="text-[#7c3aed]" aria-hidden />
          Öneriler
        </h3>
        <ul className="space-y-2 text-[11px] sm:text-xs text-gray-300 leading-snug list-disc pl-4 marker:text-[#7c3aed]">
          {performanceRecommendations.map((line, idx) => (
            <li key={`${idx}-${line.slice(0, 48)}`} className="pl-1">
              {line}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function OverallStatusBar({ decision }: { decision: OverallPerformanceDecision }) {
  const shell: Record<OverallPerformanceDecision["level"], string> = {
    ok: "border-emerald-500/30 bg-emerald-500/[0.06]",
    watch: "border-amber-400/35 bg-amber-500/[0.07]",
    risk: "border-red-500/35 bg-red-500/[0.07]",
    nodata: "border-white/10 bg-white/[0.03]",
  };
  const emoji: Record<OverallPerformanceDecision["level"], string> = {
    ok: "🟢",
    watch: "🟡",
    risk: "🔴",
    nodata: "⚪",
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 sm:px-5 sm:py-3.5 ${shell[decision.level]}`}>
      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-500">Genel durum</p>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-black text-white sm:text-base">
        <span aria-hidden>{emoji[decision.level]}</span>
        <span>{decision.headline}</span>
      </p>
      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-gray-400 sm:text-xs">{decision.detail}</p>
    </div>
  );
}

type ChartTipPayload = { dataKey?: string | number; value?: number | string; name?: string; color?: string };

function bandLabelForRatio(ratio: number): string {
  if (ratio > 1.5) return "Riskli";
  if (ratio >= 0.8 && ratio <= 1.3) return "Optimal";
  if (ratio > 0 && ratio < 0.8) return "Düşük yük";
  return "Dikkat";
}

function AcwrChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ChartTipPayload[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  const ratioRaw = payload.find((p) => p.dataKey === "ratio")?.value;
  const ratio = typeof ratioRaw === "number" ? ratioRaw : Number(ratioRaw);
  const zone = Number.isFinite(ratio) ? bandLabelForRatio(ratio) : "—";
  return (
    <div className="max-w-[220px] rounded-xl border border-white/10 bg-[#1c1c21] px-3 py-2.5 text-[10px] shadow-xl">
      {label != null && String(label) !== "" && (
        <p className="mb-1 font-black uppercase tracking-widest text-gray-500">{String(label)}</p>
      )}
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="font-bold tabular-nums text-gray-200">
          <span className="text-gray-500">{p.name ?? p.dataKey}: </span>
          {p.value}
        </p>
      ))}
      <p className="mt-1.5 border-t border-white/10 pt-1.5 text-[9px] font-black uppercase tracking-wide text-[#c4b5fd]">
        ACWR → {zone}
      </p>
    </div>
  );
}

function EwmaChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ChartTipPayload[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  const rRaw = payload.find((p) => p.dataKey === "ewmaRatio")?.value;
  const r = typeof rRaw === "number" ? rRaw : Number(rRaw);
  const zone = Number.isFinite(r) ? bandLabelForRatio(r) : "—";
  return (
    <div className="max-w-[220px] rounded-xl border border-white/10 bg-[#1c1c21] px-3 py-2.5 text-[10px] shadow-xl">
      {label != null && String(label) !== "" && (
        <p className="mb-1 font-black uppercase tracking-widest text-gray-500">{String(label)}</p>
      )}
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="font-bold tabular-nums text-gray-200">
          <span className="text-gray-500">{p.name ?? p.dataKey}: </span>
          {p.value}
        </p>
      ))}
      <p className="mt-1.5 border-t border-white/10 pt-1.5 text-[9px] font-black uppercase tracking-wide text-[#c4b5fd]">
        EWMA oran → {zone}
      </p>
    </div>
  );
}

function ChartEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[100px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 px-3 py-4 text-center">
      <Activity className="text-gray-600" size={18} aria-hidden />
      <p className="text-[8px] font-bold uppercase tracking-wide text-gray-600 leading-relaxed max-w-sm">{message}</p>
    </div>
  );
}

function CompactKpi({
  label,
  primary,
  unit,
  statusLine,
  detail,
  narrativeTone,
  icon,
  metricTooltip,
}: {
  label: string;
  primary: string | number;
  unit?: string;
  statusLine?: string;
  detail?: string;
  narrativeTone: "red" | "green" | "purple" | "neutral" | "amber";
  icon: ReactNode;
  metricTooltip?: string;
}) {
  const ring: Record<typeof narrativeTone, string> = {
    red: "border-red-500/30 bg-red-500/[0.05]",
    green: "border-emerald-500/30 bg-emerald-500/[0.05]",
    purple: "border-[#7c3aed]/28 bg-[#7c3aed]/[0.06]",
    neutral: "border-white/10 bg-white/[0.02]",
    amber: "border-amber-400/30 bg-amber-500/[0.06]",
  };
  return (
    <div className={`flex min-h-[132px] flex-col rounded-xl border p-3 shadow-sm min-w-0 ${ring[narrativeTone]}`}>
      <div className="flex items-start justify-between gap-1">
        <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 leading-tight break-words pr-1">
          {label}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {metricTooltip ? (
            <span title={metricTooltip} className="text-gray-500 hover:text-[#c4b5fd] cursor-help touch-manipulation p-0.5">
              <Info size={13} aria-hidden />
            </span>
          ) : null}
          <span className="text-gray-500 opacity-85">{icon}</span>
        </span>
      </div>
      <div className="mt-auto flex flex-col gap-1 pt-2">
        <div className="flex flex-wrap items-baseline gap-1">
          <span className="text-2xl font-black italic tabular-nums tracking-tight text-white">{primary}</span>
          {unit ? <span className="text-[9px] font-bold uppercase text-gray-500">{unit}</span> : null}
        </div>
        {statusLine ? (
          <p className="text-[9px] font-black uppercase tracking-wide text-gray-300 line-clamp-1">
            {narrativeTone === "red" ? "🔴 " : narrativeTone === "amber" ? "🟡 " : narrativeTone === "green" ? "🟢 " : ""}
            {statusLine}
          </p>
        ) : null}
        {detail ? (
          <p className="text-[8px] font-semibold uppercase leading-snug tracking-wide text-gray-600 line-clamp-2">
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  );
}
