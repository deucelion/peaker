"use client";

import type { ReactNode } from "react";

type Tone = "neutral" | "purple" | "amber" | "emerald" | "sky" | "rose";

const TONE: Record<Tone, string> = {
  neutral: "border-white/10 bg-white/5 text-gray-300",
  purple: "border-[#7c3aed]/25 bg-[#7c3aed]/10 text-[#c4b5fd]",
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
      className={`flex min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2 ${TONE[tone]}`}
    >
      <div className="min-w-0">
        <p className="text-[8px] font-black uppercase tracking-wide text-gray-500">{label}</p>
        <p className="truncate text-sm font-black tabular-nums text-white">{value}</p>
        {sublabel ? (
          <p className="truncate text-[9px] font-bold text-gray-500">{sublabel}</p>
        ) : null}
      </div>
      {icon ? <div className="shrink-0 opacity-80">{icon}</div> : null}
    </div>
  );
}
