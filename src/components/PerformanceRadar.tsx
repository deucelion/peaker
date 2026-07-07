"use client";
import { useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import {
  listWellnessReportsForAthleteRadar,
  type WellnessRadarRow,
} from "@/lib/actions/wellnessFormActions";
import { HardNavLink } from "@/components/navigation/HardNavLink";

export default function PerformanceRadar() {
  const [reports, setReports] = useState<WellnessRadarRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChart, setShowChart] = useState(false);

  useEffect(() => {
    let active = true;

    async function fetchRadarData() {
      try {
        setLoading(true);
        const res = await listWellnessReportsForAthleteRadar();
        if (!active) return;
        if ("error" in res) {
          setReports([]);
          return;
        }
        setReports(res.rows);
      } catch {
        if (active) setReports([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    void fetchRadarData();
    return () => {
      active = false;
    };
  }, []);

  const hasData = reports.length > 0;

  const data = useMemo(() => {
    if (!hasData) {
      return [
        { subject: "UYKU", A: 0, fullMark: 100 },
        { subject: "ENERJI", A: 0, fullMark: 100 },
        { subject: "YORGUNLUK", A: 0, fullMark: 100 },
        { subject: "AGRI", A: 0, fullMark: 100 },
        { subject: "STRES", A: 0, fullMark: 100 },
        { subject: "NABIZ", A: 0, fullMark: 100 },
      ];
    }

    const avg = (key: keyof WellnessRadarRow) =>
      reports.reduce((sum, r) => sum + (Number(r[key]) || 0), 0) / reports.length;

    const sleepScore = Math.round(avg("sleep_quality") * 20);
    const energyScore = Math.round(avg("energy_level") * 20);
    const fatigueScore = 100 - Math.round(avg("fatigue") * 20);
    const sorenessScore = 100 - Math.round(avg("muscle_soreness") * 20);
    const stressScore = 100 - Math.round(avg("stress_level") * 20);
    const hrAvg = avg("resting_heart_rate");
    const heartScore = Math.max(0, Math.min(100, Math.round(((95 - hrAvg) / 45) * 100)));

    return [
      { subject: "UYKU", A: sleepScore, fullMark: 100 },
      { subject: "ENERJI", A: energyScore, fullMark: 100 },
      { subject: "YORGUNLUK", A: fatigueScore, fullMark: 100 },
      { subject: "AGRI", A: sorenessScore, fullMark: 100 },
      { subject: "STRES", A: stressScore, fullMark: 100 },
      { subject: "NABIZ", A: heartScore, fullMark: 100 },
    ];
  }, [hasData, reports]);

  if (loading) {
    return (
      <div className="h-[180px] w-full min-w-0 animate-pulse rounded-xl border border-white/5 bg-[#121215]" />
    );
  }

  if (!hasData) {
    return (
      <div className="flex h-[180px] w-full min-w-0 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/20 px-4 text-center">
        <TrendingUp className="mb-3 text-[#7c3aed]/40" size={28} aria-hidden />
        <p className="text-xs font-black uppercase italic text-gray-300">Henüz yeterli veri yok</p>
        <p className="mt-2 max-w-xs text-[11px] font-bold text-gray-500">
          İyi oluş raporu girdikçe beceri radarı ve performans analizi oluşur.
        </p>
        <HardNavLink
          href="/sporcu/sabah-raporu"
          className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl border border-[#7c3aed]/30 bg-[#7c3aed]/10 px-4 text-[10px] font-black uppercase text-[#c4b5fd] touch-manipulation"
        >
          Sabah raporu gir
        </HardNavLink>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 rounded-xl border border-white/5 bg-[#121215] p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-black uppercase italic tracking-tight text-white">
            Performans Analizi
          </h3>
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#7c3aed]">
            Son 14 gün iyi oluş verisi
          </p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#7c3aed]/20 bg-[#7c3aed]/10 text-[#7c3aed]">
          <TrendingUp size={18} aria-hidden />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {data.map((item) => (
          <div key={item.subject} className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-center">
            <dt className="text-[8px] font-black uppercase tracking-wide text-gray-500">{item.subject}</dt>
            <dd className="text-lg font-black tabular-nums text-white">{item.A}</dd>
          </div>
        ))}
      </dl>

      {showChart ? (
        <div className="ui-chart-shell ui-chart-shell--passive mt-3 h-[min(38vw,9rem)] min-h-[120px] w-full sm:h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="72%" data={data}>
              <PolarGrid stroke="#ffffff10" strokeDasharray="3 3" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{
                  fill: "#6b7280",
                  fontSize: 9,
                  fontWeight: "900",
                  letterSpacing: "0.08em",
                }}
              />
              <Radar
                name="Sporcu"
                dataKey="A"
                stroke="#7c3aed"
                strokeWidth={2}
                fill="#7c3aed"
                fillOpacity={0.28}
                animationBegin={120}
                animationDuration={900}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowChart(true)}
          className="mt-3 min-h-10 w-full touch-manipulation rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[10px] font-black uppercase text-gray-400"
        >
          Radar grafiğini göster
        </button>
      )}
    </div>
  );
}
