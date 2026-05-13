"use client";

import Link from "next/link";
import { BarChart2, ClipboardList, CreditCard, FileText } from "lucide-react";
import { QuickStat } from "./AthleteDetailPrimitives";
import type { WellnessReportRow } from "@/types/performance";

/**
 * Faz 7.7 — Sporcu özet / kritik durum çubuğu.
 *
 * Daha önceki "sporcu-ozet" section'ının davranış parity'li ekstraktıdır.
 * Tüm state ve derived value'lar prop olarak gelir; component yalnız render eder.
 */

export type CriticalSignalTone = "red" | "amber" | "emerald" | "violet" | "neutral";
export type CriticalSignal = { key: string; label: string; tone: CriticalSignalTone };

const TONE_CLASS: Record<CriticalSignalTone, string> = {
  red: "border-red-500/35 bg-red-500/15 text-red-200",
  amber: "border-amber-500/35 bg-amber-500/15 text-amber-200",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  violet: "border-[#7c3aed]/35 bg-[#7c3aed]/15 text-[#c4b5fd]",
  neutral: "border-white/10 bg-white/5 text-gray-300",
};

export function AthleteCriticalStatusBar({
  athleteId,
  criticalSignals,
  priorityCue,
  acwrStatus,
  activeInjuryCount,
  latestWellness,
  trainingLoadsCount,
  financePackage,
  localizedPaymentStatus,
}: {
  athleteId: string | undefined;
  criticalSignals: CriticalSignal[];
  priorityCue: { text: string; wrapClass: string; textClass: string };
  acwrStatus: { ratio: number; label: string };
  activeInjuryCount: number;
  latestWellness: WellnessReportRow | null;
  trainingLoadsCount: number;
  financePackage: {
    activePackageName: string | null;
    remainingLessons: number | null;
  } | null;
  localizedPaymentStatus: string;
}) {
  return (
    <section
      id="sporcu-ozet"
      className="rounded-2xl md:rounded-3xl border border-white/5 bg-[#121215] p-5 md:p-7 shadow-xl min-w-0"
    >
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <h2 className="text-sm font-black italic uppercase tracking-tight text-white md:text-base">
            Sporcu <span className="text-[#7c3aed]">özeti</span>
          </h2>
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="status"
            aria-label="Sporcu kritik durum sinyalleri"
          >
            {criticalSignals.map((signal) => (
              <span
                key={signal.key}
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${TONE_CLASS[signal.tone]}`}
              >
                {signal.label}
              </span>
            ))}
          </div>
          <div className={`rounded-xl border px-4 py-3 ${priorityCue.wrapClass}`}>
            <p className={`text-[11px] font-bold leading-relaxed ${priorityCue.textClass}`}>{priorityCue.text}</p>
          </div>
          {athleteId ? (
            <p className="text-[10px] font-bold text-gray-500">
              Şimdi:{" "}
              <Link
                href={`/finans/${athleteId}`}
                className="text-[#c4b5fd] underline-offset-2 touch-manipulation sm:hover:text-[#e9d5ff]"
              >
                Finansı
              </Link>
              ,{" "}
              <a href="#sakatlik-gecmisi" className="text-[#c4b5fd] underline-offset-2 touch-manipulation sm:hover:text-[#e9d5ff]">
                sakatlığı
              </a>
              ,{" "}
              <Link
                href="/performans/wellness-detay"
                className="text-[#c4b5fd] underline-offset-2 touch-manipulation sm:hover:text-[#e9d5ff]"
              >
                wellness arşivini
              </Link>{" "}
              ve{" "}
              <Link
                href="/notlar-haftalik-program"
                className="text-[#c4b5fd] underline-offset-2 touch-manipulation sm:hover:text-[#e9d5ff]"
              >
                program notlarını
              </Link>{" "}
              kontrol edin.
            </p>
          ) : null}
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:max-w-xl lg:shrink-0">
          <QuickStat label="ACWR" value={String(acwrStatus.ratio)} sub={acwrStatus.label} />
          <QuickStat label="Aktif sakatlık" value={activeInjuryCount} sub="kayıt" />
          <QuickStat
            label="Son wellness"
            value={latestWellness ? new Date(latestWellness.report_date).toLocaleDateString("tr-TR") : "—"}
            sub={latestWellness ? "Tarih" : "Kayıt yok"}
          />
          <QuickStat label="Yük kaydı" value={trainingLoadsCount} sub="satır" />
        </div>
      </div>

      <div className="mt-5 grid gap-2 rounded-2xl border border-white/10 bg-black/25 p-4 text-[11px] font-bold sm:grid-cols-4">
        <div>
          <p className="text-gray-500">Aktif paket</p>
          <p className="mt-1 text-white">{financePackage?.activePackageName || "Yok"}</p>
        </div>
        <div>
          <p className="text-gray-500">Kalan ders</p>
          <p className="mt-1 text-white tabular-nums">{financePackage?.remainingLessons ?? "—"}</p>
        </div>
        <div>
          <p className="text-gray-500">Ödeme durumu</p>
          <p className="mt-1 text-white">{localizedPaymentStatus}</p>
        </div>
        <div>
          <p className="text-gray-500">Finans & Paket</p>
          {athleteId ? (
            <Link href={`/finans/${athleteId}`} className="mt-1 inline-block text-[#c4b5fd] sm:hover:text-[#e9d5ff]">
              Detaya git →
            </Link>
          ) : (
            <p className="mt-1 text-white">—</p>
          )}
        </div>
      </div>

      {athleteId ? (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-white/5 pt-5">
          <Link
            href={`/finans/${athleteId}`}
            className="inline-flex min-h-11 min-w-[140px] flex-1 items-center justify-center gap-2 rounded-xl border border-[#7c3aed]/30 bg-[#7c3aed]/10 px-3 text-[10px] font-black uppercase text-[#c4b5fd] touch-manipulation sm:hover:border-[#7c3aed]/50"
          >
            <CreditCard size={14} aria-hidden /> Finans
          </Link>
          <a
            href="#sakatlik-gecmisi"
            className="inline-flex min-h-11 min-w-[140px] flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-[10px] font-black uppercase text-gray-300 touch-manipulation sm:hover:bg-white/10"
          >
            <ClipboardList size={14} aria-hidden /> Sakatlık
          </a>
          <Link
            href="/performans/wellness-detay"
            className="inline-flex min-h-11 min-w-[140px] flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-[10px] font-black uppercase text-gray-300 touch-manipulation sm:hover:bg-white/10"
          >
            <BarChart2 size={14} aria-hidden /> Wellness
          </Link>
          <Link
            href="/notlar-haftalik-program"
            className="inline-flex min-h-11 min-w-[140px] flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-[10px] font-black uppercase text-gray-300 touch-manipulation sm:hover:bg-white/10"
          >
            <FileText size={14} aria-hidden /> Program
          </Link>
        </div>
      ) : null}
    </section>
  );
}

export default AthleteCriticalStatusBar;
