"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * Faz 7.7 — Sporcu detay sayfa başlığı.
 * Geri linki + ACWR durum rozeti. Parent'tan state alır; davranışsal değişiklik yok.
 */
export function AthleteHeader({
  acwrStatus,
  backHref = "/oyuncular",
  backLabel = "KADRO ANALİZİNE DÖN",
}: {
  acwrStatus: { ratio: number; label: string; color: string };
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center min-w-0">
      <Link
        href={backHref}
        className="group inline-flex items-center gap-3 text-gray-500 sm:hover:text-white transition-all self-start min-h-11 touch-manipulation rounded-xl"
      >
        <div className="shrink-0 rounded-xl border border-white/5 bg-[#121215] p-2.5 shadow-lg transition-all sm:group-hover:bg-[#7c3aed]/20">
          <ChevronLeft size={18} aria-hidden />
        </div>
        <span className="text-[9px] font-black italic uppercase tracking-[0.2em] sm:tracking-[0.25em] text-white break-words">
          {backLabel}
        </span>
      </Link>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 py-2 sm:px-4 sm:py-2.5 bg-[#121215] border border-white/5 rounded-xl shadow-lg min-w-0 max-w-full">
        <div className={`w-2 h-2 shrink-0 rounded-full animate-pulse ${acwrStatus.color.replace("text", "bg")}`} />
        <span
          className={`text-[8px] sm:text-[9px] font-black italic uppercase tracking-wide sm:tracking-wider break-words ${acwrStatus.color}`}
        >
          DURUM: {acwrStatus.label} <span className="mx-1 sm:mx-2 opacity-20">|</span> ACWR: {acwrStatus.ratio}
        </span>
      </div>
    </div>
  );
}

export default AthleteHeader;
