"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import type { OverallPerformanceDecision } from "@/lib/performance/performanceDecision";
import { ChartNoData } from "@/components/ui/data-display/ChartNoData";
import {
  chartTooltipContentStyle,
  chartTooltipItemStyle,
} from "@/lib/ui/branding/chartSelectors";

/**
 * Faz 5.1 (kısmî) — Performans Merkezi presentational parçaları.
 *
 * page.tsx hâlâ büyük (1300+ satır) çünkü filtre + fetch + KPI hesabı durumu
 * tek yerde duruyor. Tam parçalama Faz 6'ya bırakılıyor; bu dosya yalnızca
 * davranışsız (presentational) bileşenleri çıkararak okunabilirliği artırır:
 *
 *   - OverallStatusBar
 *   - AcwrChartTooltip
 *   - EwmaChartTooltip
 *   - ChartEmptyState
 *   - CompactKpi
 *
 * Stil/markup birebir orijinaliyle aynıdır.
 */

export type ChartTipPayload = { dataKey?: string | number; value?: number | string; name?: string; color?: string };

function bandLabelForRatio(ratio: number): string {
  if (ratio > 1.5) return "Riskli";
  if (ratio >= 0.8 && ratio <= 1.3) return "Optimal";
  if (ratio > 0 && ratio < 0.8) return "Düşük yük";
  return "Dikkat";
}

export function OverallStatusBar({ decision }: { decision: OverallPerformanceDecision }) {
  const shell: Record<OverallPerformanceDecision["level"], string> = {
    ok: "border-emerald-500/30 bg-emerald-500/[0.06]",
    watch: "border-amber-400/35 bg-amber-500/[0.07]",
    risk: "border-red-500/35 bg-red-500/[0.07]",
    nodata: "ui-kpi-band",
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

export function AcwrChartTooltip({
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
  const tooltipShell = chartTooltipContentStyle();
  const tooltipAccent = chartTooltipItemStyle();
  return (
    <div style={tooltipShell} className="max-w-[220px] px-3 py-2.5 text-[10px] shadow-xl">
      {label != null && String(label) !== "" && (
        <p className="mb-1 font-black uppercase tracking-widest text-gray-500">{String(label)}</p>
      )}
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="font-bold tabular-nums text-gray-200">
          <span className="text-gray-500">{p.name ?? p.dataKey}: </span>
          {p.value}
        </p>
      ))}
      <p style={tooltipAccent} className="mt-1.5 border-t pt-1.5 text-[9px] font-black uppercase tracking-wide">
        ACWR → {zone}
      </p>
    </div>
  );
}

export function EwmaChartTooltip({
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
  const tooltipShell = chartTooltipContentStyle();
  const tooltipAccent = chartTooltipItemStyle();
  return (
    <div style={tooltipShell} className="max-w-[220px] px-3 py-2.5 text-[10px] shadow-xl">
      {label != null && String(label) !== "" && (
        <p className="mb-1 font-black uppercase tracking-widest text-gray-500">{String(label)}</p>
      )}
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="font-bold tabular-nums text-gray-200">
          <span className="text-gray-500">{p.name ?? p.dataKey}: </span>
          {p.value}
        </p>
      ))}
      <p style={tooltipAccent} className="mt-1.5 border-t pt-1.5 text-[9px] font-black uppercase tracking-wide">
        EWMA oran → {zone}
      </p>
    </div>
  );
}

export function ChartEmptyState({ message }: { message: string }) {
  return <ChartNoData label={message} />;
}

export type CompactKpiTone = "red" | "green" | "purple" | "neutral" | "amber";

export function CompactKpi({
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
  narrativeTone: CompactKpiTone;
  icon: ReactNode;
  metricTooltip?: string;
}) {
  const ring: Record<CompactKpiTone, string> = {
    red: "border-red-500/30 bg-red-500/[0.05]",
    green: "border-emerald-500/30 bg-emerald-500/[0.05]",
    purple:
      "border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_28%,transparent)] bg-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_6%,transparent)]",
    neutral: "ui-card-inner",
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
            <span
              title={metricTooltip}
              className="text-gray-500 hover:ui-kpi-card__trend cursor-help touch-manipulation p-0.5"
            >
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
