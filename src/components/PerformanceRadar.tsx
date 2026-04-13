"use client";
import { useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react"; 
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  ResponsiveContainer 
} from 'recharts';
import {
  listWellnessReportsForAthleteRadar,
  type WellnessRadarRow,
} from "@/lib/actions/wellnessFormActions";

export default function PerformanceRadar() {
  const [reports, setReports] = useState<WellnessRadarRow[]>([]);
  const [loading, setLoading] = useState(true);

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

  const data = useMemo(() => {
    if (reports.length === 0) {
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
  }, [reports]);

  if (loading) return (
    <div className="h-[450px] w-full bg-[#121215] rounded-[3.5rem] border border-white/5 animate-pulse" />
  );

  return (
    <div className="bg-[#121215] p-10 rounded-[3.5rem] border border-white/5 h-[450px] w-full group sm:hover:border-[#7c3aed]/30 transition-all shadow-2xl relative overflow-hidden">
      <div className="flex justify-between items-center mb-8 relative z-10">
        <div>
          <h3 className="text-white font-black italic uppercase text-lg tracking-tight">Performans Analizi</h3>
          <p className="text-[#7c3aed] text-[9px] font-black uppercase tracking-[0.3em]">Son 14 Gun Wellness Verisi</p>
        </div>
        <div className="w-10 h-10 bg-[#7c3aed]/10 text-[#7c3aed] rounded-xl flex items-center justify-center border border-[#7c3aed]/20">
          <TrendingUp size={20} />
        </div>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
            <PolarGrid stroke="#ffffff10" strokeDasharray="3 3" />
            <PolarAngleAxis 
              dataKey="subject" 
              tick={{ 
                fill: '#6b7280', 
                fontSize: 10, 
                fontWeight: '900',
                letterSpacing: '0.1em'
              }} 
            />
            <Radar
              name="Sporcu"
              dataKey="A"
              stroke="#7c3aed"
              strokeWidth={3}
              fill="#7c3aed"
              fillOpacity={0.3}
              animationBegin={180}
              animationDuration={1500}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-[#7c3aed]/5 rounded-full blur-[100px]" />
    </div>
  );
}