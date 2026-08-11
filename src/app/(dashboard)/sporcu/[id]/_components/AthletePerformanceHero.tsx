"use client";

import Link from "next/link";
import { Activity, TrendingUp } from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { ChartFrame, chartTooltipStyle } from "@/components/ui/charts";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";

/**
 * Faz 7.7 — Hızlı performans hero (radar + son 7 gün yük).
 * Parent'tan veri prop'ları alır; render-only.
 */

export type RadarPoint = {
  subject: string;
  A: number;
  fullMark: number;
  fullName: string;
  unit?: string;
  rawValue: number;
};

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
        <h2 className={`${uiBrandingClasses.typography.label} text-xs sm:text-sm`}>
          Hızlı performans görünümü
        </h2>
        <Link
          href="#performans-analitigi"
          className="ui-breadcrumb__link shrink-0 text-[10px] font-black uppercase touch-manipulation"
        >
          ACWR ve wellness analitiği →
        </Link>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-5 md:gap-6 lg:grid-cols-2">
        <div
          className={`${uiBrandingClasses.card.chart} relative min-w-0 overflow-hidden rounded-2xl !p-5 shadow-xl md:rounded-3xl md:!p-7`}
        >
          <div className="mb-2 flex items-center gap-3">
            <div
              className={`${uiBrandingClasses.kpi.chipBrand} flex items-center justify-center p-2 text-[color:var(--peaker-ui-PRIMARY)]`}
            >
              <Activity size={18} />
            </div>
            <div className="min-w-0">
              <h3 className={`${uiBrandingClasses.typography.h2Sm} text-sm md:text-base`}>
                Yetenek <span className="text-[color:var(--peaker-ui-PRIMARY)]">Spektrumu</span>
              </h3>
              <p className={`${uiBrandingClasses.kpi.cardHint} mt-0.5 text-[9px] font-bold normal-case`}>
                En güncel {radarData.length || 8} test · kişisel geçmişe göre 0–100
              </p>
            </div>
          </div>
          <ChartFrame
            isEmpty={radarData.length === 0}
            emptyLabel="ATLETİK TEST VERİSİ GİRİLMEMİŞ"
          >
            <RadarChart cx="50%" cy="50%" outerRadius="62%" data={radarData}>
              <PolarGrid stroke="#ffffff08" radialLines={false} />
              <Radar
                name="Sporcu"
                dataKey="A"
                stroke="var(--peaker-ui-PRIMARY)"
                fill="var(--peaker-ui-PRIMARY)"
                fillOpacity={0.35}
                strokeWidth={2}
              />
            </RadarChart>
          </ChartFrame>
          {radarData.length > 0 ? (
            <ul className={`${uiBrandingClasses.card.inner} mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-white/5 pt-4`}>
              {radarData.map((p) => (
                <li key={p.fullName} className="flex min-w-0 items-baseline justify-between gap-2 text-[9px]">
                  <span
                    className={`${uiBrandingClasses.kpi.cardHint} truncate font-bold uppercase`}
                    title={p.fullName}
                  >
                    {p.fullName}
                  </span>
                  <span className={`${uiBrandingClasses.kpi.cardTrend} shrink-0 tabular-nums`}>
                    {p.rawValue}
                    {p.unit ? (
                      <span className={`${uiBrandingClasses.kpi.cardHint} ml-0.5 text-[8px]`}>{p.unit}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div
          className={`${uiBrandingClasses.card.chart} relative min-w-0 overflow-hidden rounded-2xl !p-5 shadow-xl md:rounded-3xl md:!p-7`}
        >
          <div className="mb-5 flex min-w-0 items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={`${uiBrandingClasses.kpi.chipBrand} shrink-0 p-2 text-[color:var(--peaker-ui-PRIMARY)]`}
              >
                <TrendingUp size={18} />
              </div>
              <h3 className={`${uiBrandingClasses.typography.h2Sm} min-w-0 break-words text-sm md:text-base`}>
                Yük <span className="text-[color:var(--peaker-ui-PRIMARY)]">Dinamikleri</span>
              </h3>
            </div>
            <div className={`${uiBrandingClasses.badge.neutral} hidden shrink-0 rounded-full px-3 py-1.5 text-[8px] tracking-widest md:block`}>
              SON 7 GÜN
            </div>
          </div>
          <ChartFrame
            isEmpty={weeklyLoads.length === 0}
            emptyLabel="ANTRENMAN YÜK VERİSİ EKSİK"
          >
            <LineChart data={weeklyLoads} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff03" vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#4b5563", fontSize: 10, fontWeight: 700 }}
              />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#4b5563", fontSize: 10 }} />
              <Tooltip
                contentStyle={chartTooltipStyle.contentStyle}
                itemStyle={chartTooltipStyle.itemStyle}
              />
              <Line
                type="monotone"
                dataKey="yuk"
                stroke="var(--peaker-ui-PRIMARY)"
                strokeWidth={3}
                dot={{
                  fill: "var(--peaker-ui-PRIMARY)",
                  stroke: "var(--peaker-ui-SURFACE)",
                  strokeWidth: 2,
                  r: 4,
                }}
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
