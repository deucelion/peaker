"use client";

import Link from "next/link";
import { Activity, TrendingUp } from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { ChartFrame, chartTooltipStyle } from "@/components/ui/charts";

/**
 * Faz 7.7 — Hızlı performans hero (radar + son 7 gün yük).
 * Parent'tan veri prop'ları alır; render-only.
 */

export type RadarPoint = { subject: string; A: number; fullMark: number };
export type WeeklyLoadPoint = { date: string; yuk: number };

export function AthletePerformanceHero({
  radarData,
  weeklyLoads,
}: {
  radarData: RadarPoint[];
  weeklyLoads: WeeklyLoadPoint[];
}) {
  return (
    <section id="hizli-performans" className="min-w-0 space-y-3">
      <div className="mb-1 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-xs font-black italic uppercase tracking-tight text-gray-400 sm:text-sm">
          Hızlı performans görünümü
        </h2>
        <Link
          href="#performans-analitigi"
          className="shrink-0 text-[10px] font-black uppercase text-[#c4b5fd] touch-manipulation sm:hover:text-[#e9d5ff]"
        >
          ACWR ve wellness analitiği →
        </Link>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6 min-w-0">
        <div className="bg-[#121215] border border-white/5 rounded-2xl md:rounded-3xl p-5 md:p-7 shadow-xl relative overflow-hidden min-w-0">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 bg-[#7c3aed]/10 rounded-xl text-[#7c3aed]">
              <Activity size={18} />
            </div>
            <h3 className="text-sm md:text-base font-black italic text-white uppercase tracking-tight">
              Yetenek <span className="text-[#7c3aed]">Spektrumu</span>
            </h3>
          </div>
          <ChartFrame
            isEmpty={radarData.length === 0}
            emptyLabel="ATLETİK TEST VERİSİ GİRİLMEMİŞ"
          >
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
              <PolarGrid stroke="#ffffff05" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: "#6b7280", fontSize: 10, fontWeight: 700 }} />
              <Radar name="Sporcu" dataKey="A" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.4} strokeWidth={4} />
            </RadarChart>
          </ChartFrame>
        </div>

        <div className="bg-[#121215] border border-white/5 rounded-2xl md:rounded-3xl p-5 md:p-7 shadow-xl relative overflow-hidden min-w-0">
          <div className="flex justify-between items-start mb-5 gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-[#7c3aed]/10 rounded-xl text-[#7c3aed] shrink-0">
                <TrendingUp size={18} />
              </div>
              <h3 className="text-sm md:text-base font-black italic text-white uppercase tracking-tight break-words min-w-0">
                Yük <span className="text-[#7c3aed]">Dinamikleri</span>
              </h3>
            </div>
            <div className="hidden md:block px-3 py-1.5 bg-black border border-white/5 rounded-full text-[8px] font-black text-gray-600 uppercase tracking-widest shrink-0">
              SON 7 GÜN
            </div>
          </div>
          <ChartFrame
            isEmpty={weeklyLoads.length === 0}
            emptyLabel="ANTRENMAN YÜK VERİSİ EKSİK"
          >
            <LineChart data={weeklyLoads} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff03" vertical={false} />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#4b5563", fontSize: 10, fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#4b5563", fontSize: 10 }} />
              <Tooltip
                contentStyle={chartTooltipStyle.contentStyle}
                itemStyle={chartTooltipStyle.itemStyle}
              />
              <Line
                type="monotone"
                dataKey="yuk"
                stroke="#7c3aed"
                strokeWidth={3}
                dot={{ fill: "#7c3aed", stroke: "#121215", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          </ChartFrame>
        </div>
      </div>
    </section>
  );
}

export default AthletePerformanceHero;
