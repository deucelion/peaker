"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";

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
    <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <Link
        href={backHref}
        className="group inline-flex min-h-11 touch-manipulation items-center gap-3 self-start rounded-xl text-gray-500 transition-all sm:hover:text-white"
      >
        <div
          className={`${uiBrandingClasses.card.inner} shrink-0 p-2.5 shadow-lg transition-all sm:group-hover:border-[color-mix(in_srgb,var(--peaker-ui-PRIMARY)_20%,transparent)] sm:group-hover:bg-[color-mix(in_srgb,var(--peaker-ui-PRIMARY)_20%,transparent)]`}
        >
          <ChevronLeft size={18} aria-hidden />
        </div>
        <span className="break-words text-[9px] font-black uppercase italic tracking-[0.2em] text-white sm:tracking-[0.25em]">
          {backLabel}
        </span>
      </Link>

      <div
        className={`${uiBrandingClasses.card.compact} flex max-w-full min-w-0 flex-wrap items-center gap-2 px-3 py-2 shadow-lg sm:gap-3 sm:px-4 sm:py-2.5`}
      >
        <div
          className={`h-2 w-2 shrink-0 animate-pulse rounded-full ${acwrStatus.color.replace("text", "bg")}`}
        />
        <span
          className={`break-words text-[8px] font-black uppercase italic tracking-wide sm:text-[9px] sm:tracking-wider ${acwrStatus.color}`}
        >
          DURUM: {acwrStatus.label}{" "}
          <span className="mx-1 opacity-20 sm:mx-2">|</span> ACWR: {acwrStatus.ratio}
        </span>
      </div>
    </div>
  );
}

export default AthleteHeader;
