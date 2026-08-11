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
import { ChartNoData } from "@/components/ui/charts";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";

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
      <div
        className={`${uiBrandingClasses.chart.shell} ${uiBrandingClasses.skeleton.pulse} h-[180px] w-full min-w-0 rounded-xl border border-white/5`}
      />
    );
  }

  if (!hasData) {
    return (
      <div
        className={`${uiBrandingClasses.chart.shell} flex h-[180px] w-full min-w-0 flex-col items-center justify-center gap-2 px-4`}
      >
        <ChartNoData label="Henüz yeterli veri yok" />
        <p className="ui-empty-state__description max-w-xs text-center text-[11px] font-bold">
          İyi oluş raporu girdikçe beceri radarı ve performans analizi oluşur.
        </p>
        <HardNavLink href="/sporcu/sabah-raporu" className="ui-empty-state__action">
          Sabah raporu gir
        </HardNavLink>
      </div>
    );
  }

  return (
    <div className={`${uiBrandingClasses.chart.shell} w-full min-w-0 rounded-xl border border-white/5 p-3 sm:p-4`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-black uppercase italic tracking-tight text-white">
            Performans Analizi
          </h3>
          <p className={uiBrandingClasses.kpi.cardTrend}>Son 14 gün iyi oluş verisi</p>
        </div>
        <div
          className={`${uiBrandingClasses.kpi.chipBrand} flex h-9 w-9 shrink-0 items-center justify-center !min-h-0 !p-0 text-[color:var(--peaker-ui-PRIMARY)]`}
        >
          <TrendingUp size={18} aria-hidden />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {data.map((item) => (
          <div key={item.subject} className={uiBrandingClasses.kpi.card}>
            <dt className={`${uiBrandingClasses.kpi.cardLabel} text-[8px] tracking-wide`}>{item.subject}</dt>
            <dd className={`${uiBrandingClasses.kpi.cardValue} text-lg`}>{item.A}</dd>
          </div>
        ))}
      </dl>

      {showChart ? (
        <div
          className={`${uiBrandingClasses.chart.shell} ${uiBrandingClasses.chart.shellPassive} mt-3 h-[min(38vw,9rem)] min-h-[120px] w-full sm:h-[140px]`}
        >
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
                stroke="var(--peaker-ui-PRIMARY)"
                strokeWidth={2}
                fill="var(--peaker-ui-PRIMARY)"
                fillOpacity={0.28}
                animationBegin={120}
                animationDuration={900}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <button type="button" onClick={() => setShowChart(true)} className="ui-btn-ghost mt-3 min-h-10 w-full">
          Radar grafiğini göster
        </button>
      )}
    </div>
  );
}
