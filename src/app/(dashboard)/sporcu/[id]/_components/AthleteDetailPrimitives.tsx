"use client";

import type { ReactNode } from "react";
import { Activity } from "lucide-react";

/**
 * Faz 6.1 — Sporcu detay sayfasının paylaşılan küçük presentational primitive'leri.
 */

export function QuickStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-2.5">
      <p className="text-[8px] font-black uppercase tracking-wider text-gray-600">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
      <p className="text-[8px] font-bold uppercase text-gray-500">{sub}</p>
    </div>
  );
}

export function MetricBadge({
  icon,
  label,
  val,
  color = "text-white",
}: {
  icon: ReactNode;
  label: string;
  val: string;
  color?: string;
}) {
  return (
    <div className="bg-black/40 px-3 py-2.5 rounded-xl border border-white/5 flex items-center gap-2.5 transition-all sm:hover:border-[#7c3aed]/30 sm:hover:bg-black/60 shadow-md group/m min-w-0">
      <div className="shrink-0 text-[#7c3aed] transition-transform sm:group-hover/m:scale-105">{icon}</div>
      <div className="flex flex-col min-w-0">
        <span className="text-[7px] font-black text-gray-600 uppercase tracking-wider">{label}</span>
        <span className={`${color} font-black italic text-xs sm:text-sm tracking-tight break-words`}>{val}</span>
      </div>
    </div>
  );
}

export function NoData({ label }: { label: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center border border-dashed border-white/5 rounded-2xl bg-black/20 group px-4">
      <Activity
        className="mb-3 text-gray-800 transition-colors sm:group-hover:text-[#7c3aed]"
        size={32}
        aria-hidden
      />
      <p className="text-center text-[8px] font-black uppercase italic leading-relaxed tracking-[0.25em] text-gray-700 break-words">
        {label}
      </p>
    </div>
  );
}
