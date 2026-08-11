"use client";

import type { ReactNode } from "react";

type Tone = "neutral" | "purple" | "amber" | "emerald" | "sky" | "rose";

const TONE: Record<Tone, string> = {
  neutral: "",
  purple: "ui-kpi-chip--brand",
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-200",
  emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
  sky: "border-sky-500/25 bg-sky-500/10 text-sky-200",
  rose: "border-rose-500/25 bg-rose-500/10 text-rose-200",
};

export function CompactMetricCard({
  label,
  value,
  sublabel,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  tone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <div
      className={`ui-kpi-card flex min-w-0 items-center justify-between gap-2 rounded-xl px-3 py-2 ${TONE[tone]}`}
    >
      <div className="min-w-0">
        <p className="ui-kpi-card__label text-[8px] tracking-wide">{label}</p>
        <p className="ui-kpi-card__value truncate text-sm">{value}</p>
        {sublabel ? (
          <p className="ui-kpi-card__hint truncate text-[9px] font-bold">{sublabel}</p>
        ) : null}
      </div>
      {icon ? <div className="shrink-0 opacity-80">{icon}</div> : null}
    </div>
  );
}
