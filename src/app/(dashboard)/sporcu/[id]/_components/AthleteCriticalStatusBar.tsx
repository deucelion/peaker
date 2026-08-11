"use client";

import Link from "next/link";
import { BarChart2, ClipboardList, CreditCard, FileText } from "lucide-react";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";
import type { WellnessReportRow } from "@/types/performance";
import { hrefWellnessArchive } from "@/lib/navigation/wellnessArchiveLinks";

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
  violet: `${uiBrandingClasses.kpi.chipBrand} text-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_65%,var(--peaker-ui-TEXT_PRIMARY))]`,
  neutral: uiBrandingClasses.badge.neutral,
};

const INLINE_LINK_CLASS = "ui-breadcrumb__link underline-offset-2 touch-manipulation";

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
  const wellnessArchiveHref = athleteId
    ? hrefWellnessArchive({ athleteId })
    : hrefWellnessArchive();

  return (
    <section
      id="sporcu-ozet"
      className={`${uiBrandingClasses.card.base} min-w-0 rounded-2xl p-5 shadow-xl md:rounded-3xl md:p-7`}
    >
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <h2 className={`${uiBrandingClasses.typography.h2Sm} text-sm md:text-base`}>
            Sporcu{" "}
            <span className="text-[color:var(--peaker-ui-PRIMARY)]">özeti</span>
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
            <p className={`${uiBrandingClasses.kpi.cardHint} text-[10px] font-bold`}>
              Şimdi:{" "}
              <Link href={`/finans/${athleteId}`} className={INLINE_LINK_CLASS}>
                Finansı
              </Link>
              ,{" "}
              <a href="#sakatlik-gecmisi" className={INLINE_LINK_CLASS}>
                sakatlığı
              </a>
              ,{" "}
              <Link href={wellnessArchiveHref} className={INLINE_LINK_CLASS}>
                wellness arşivini
              </Link>{" "}
              ve{" "}
              <Link href="/notlar-haftalik-program" className={INLINE_LINK_CLASS}>
                program notlarını
              </Link>{" "}
              kontrol edin.
            </p>
          ) : null}
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:max-w-xl lg:shrink-0">
          <AthleteQuickStat label="ACWR" value={String(acwrStatus.ratio)} sub={acwrStatus.label} />
          <AthleteQuickStat label="Aktif sakatlık" value={activeInjuryCount} sub="kayıt" />
          <AthleteQuickStat
            label="Son wellness"
            value={latestWellness ? new Date(latestWellness.report_date).toLocaleDateString("tr-TR") : "—"}
            sub={latestWellness ? "Tarih" : "Kayıt yok"}
          />
          <AthleteQuickStat label="Yük kaydı" value={trainingLoadsCount} sub="satır" />
        </div>
      </div>

      <div
        className={`${uiBrandingClasses.kpi.band} mt-5 grid gap-2 text-[11px] font-bold sm:grid-cols-4`}
      >
        <div>
          <p className={uiBrandingClasses.kpi.cardHint}>Aktif paket</p>
          <p className={`${uiBrandingClasses.kpi.cardValue} mt-1 text-sm`}>
            {financePackage?.activePackageName || "Yok"}
          </p>
        </div>
        <div>
          <p className={uiBrandingClasses.kpi.cardHint}>Kalan ders</p>
          <p className={`${uiBrandingClasses.kpi.cardValue} mt-1 tabular-nums text-sm`}>
            {financePackage?.remainingLessons ?? "—"}
          </p>
        </div>
        <div>
          <p className={uiBrandingClasses.kpi.cardHint}>Ödeme durumu</p>
          <p className={`${uiBrandingClasses.kpi.cardValue} mt-1 text-sm`}>{localizedPaymentStatus}</p>
        </div>
        <div>
          <p className={uiBrandingClasses.kpi.cardHint}>Finans & Paket</p>
          {athleteId ? (
            <Link href={`/finans/${athleteId}`} className={`${INLINE_LINK_CLASS} mt-1 inline-block`}>
              Detaya git →
            </Link>
          ) : (
            <p className={`${uiBrandingClasses.kpi.cardValue} mt-1 text-sm`}>—</p>
          )}
        </div>
      </div>

      {athleteId ? (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-white/5 pt-5">
          <Link
            href={`/finans/${athleteId}`}
            className={`${uiBrandingClasses.kpi.chipBrand} ${uiBrandingClasses.button.base} inline-flex min-h-11 min-w-[140px] flex-1 touch-manipulation items-center justify-center gap-2 px-3 text-[10px]`}
          >
            <CreditCard size={14} aria-hidden /> Finans
          </Link>
          <a
            href="#sakatlik-gecmisi"
            className={`${uiBrandingClasses.button.ghost} inline-flex min-h-11 min-w-[140px] flex-1 touch-manipulation items-center justify-center gap-2 px-3 text-[10px] text-gray-300`}
          >
            <ClipboardList size={14} aria-hidden /> Sakatlık
          </a>
          <Link
            href={wellnessArchiveHref}
            className={`${uiBrandingClasses.button.ghost} inline-flex min-h-11 min-w-[140px] flex-1 touch-manipulation items-center justify-center gap-2 px-3 text-[10px] text-gray-300`}
          >
            <BarChart2 size={14} aria-hidden /> Wellness
          </Link>
          <Link
            href="/notlar-haftalik-program"
            className={`${uiBrandingClasses.button.ghost} inline-flex min-h-11 min-w-[140px] flex-1 touch-manipulation items-center justify-center gap-2 px-3 text-[10px] text-gray-300`}
          >
            <FileText size={14} aria-hidden /> Program
          </Link>
        </div>
      ) : null}
    </section>
  );
}

export default AthleteCriticalStatusBar;

function AthleteQuickStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div className={uiBrandingClasses.kpi.card}>
      <p className={`${uiBrandingClasses.kpi.cardLabel} text-[8px] tracking-wider`}>{label}</p>
      <p className={`${uiBrandingClasses.kpi.cardValue} mt-1 text-sm`}>{value}</p>
      <p className={`${uiBrandingClasses.kpi.cardHint} text-[8px] font-bold uppercase`}>{sub}</p>
    </div>
  );
}
