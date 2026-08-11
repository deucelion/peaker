"use client";

import Link from "next/link";
import EmptyState from "@/components/ui/EmptyState";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";
import type { WellnessReportRow } from "@/types/performance";
import {
  getWellnessMetricLabel,
  getWellnessScoreTone,
  wellnessToneToTextClass,
  WELLNESS_SCALE_MAX,
} from "@/lib/wellness/wellnessScore";
import { hrefWellnessArchive } from "@/lib/navigation/wellnessArchiveLinks";

const INLINE_LINK_CLASS = "ui-breadcrumb__link touch-manipulation";

/**
 * Faz 7.7 — Son wellness aside.
 * Sadece görsel; parent'tan `latestWellness` alır.
 */
export function AthleteWellnessSection({
  latestWellness,
  athleteId,
  athleteName,
}: {
  latestWellness: WellnessReportRow | null;
  athleteId?: string;
  athleteName?: string | null;
}) {
  const archiveHref = hrefWellnessArchive({
    athleteId,
    athleteName,
  });

  return (
    <aside
      id="son-wellness"
      className={`${uiBrandingClasses.card.base} flex min-w-0 flex-col gap-4 self-stretch rounded-2xl p-5 shadow-xl md:rounded-3xl md:p-7`}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <h2 className={`${uiBrandingClasses.typography.h2} text-base sm:text-lg`}>
          Son <span className="text-[color:var(--peaker-ui-PRIMARY)]">wellness</span>
        </h2>
        <Link href={archiveHref} className={`${INLINE_LINK_CLASS} shrink-0 text-[9px] font-black uppercase`}>
          Arşiv
        </Link>
      </div>
      {latestWellness ? (
        <div className={`${uiBrandingClasses.card.inner} space-y-3 rounded-2xl p-4`}>
          <p className={`${uiBrandingClasses.kpi.cardHint} text-[10px] font-bold uppercase tracking-wider`}>
            Rapor tarihi
          </p>
          <p className={`${uiBrandingClasses.kpi.cardValue} text-sm`}>
            {new Date(latestWellness.report_date).toLocaleDateString("tr-TR", { dateStyle: "long" })}
          </p>
          <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
            {latestWellness.fatigue != null ? (
              <span className={wellnessToneToTextClass(getWellnessScoreTone("fatigue", latestWellness.fatigue))}>
                Yorgunluk: {latestWellness.fatigue}/{WELLNESS_SCALE_MAX} ·{" "}
                {getWellnessMetricLabel("fatigue", latestWellness.fatigue)}
              </span>
            ) : null}
            {latestWellness.sleep_quality != null ? (
              <span
                className={wellnessToneToTextClass(
                  getWellnessScoreTone("sleep_quality", latestWellness.sleep_quality)
                )}
              >
                Uyku: {latestWellness.sleep_quality}/{WELLNESS_SCALE_MAX} ·{" "}
                {getWellnessMetricLabel("sleep_quality", latestWellness.sleep_quality)}
              </span>
            ) : null}
            {latestWellness.energy_level != null ? (
              <span
                className={wellnessToneToTextClass(
                  getWellnessScoreTone("energy_level", latestWellness.energy_level)
                )}
              >
                Enerji: {latestWellness.energy_level}/{WELLNESS_SCALE_MAX} ·{" "}
                {getWellnessMetricLabel("energy_level", latestWellness.energy_level)}
              </span>
            ) : null}
            {latestWellness.stress_level != null ? (
              <span
                className={wellnessToneToTextClass(
                  getWellnessScoreTone("stress_level", latestWellness.stress_level)
                )}
              >
                Stres: {latestWellness.stress_level}/{WELLNESS_SCALE_MAX} ·{" "}
                {getWellnessMetricLabel("stress_level", latestWellness.stress_level)}
              </span>
            ) : null}
          </div>
          <Link
            href="#performans-analitigi"
            className={`${INLINE_LINK_CLASS} inline-block text-[10px] font-black uppercase`}
          >
            Grafikler ve trendler için aşağı kaydırın →
          </Link>
        </div>
      ) : (
        <EmptyState
          variant="no_data"
          title="Kayıtlı wellness raporu yok"
          description="Sabah raporu veya wellness girişi yapıldığında burada son kayıt görünür. Tüm arşiv için wellness ekranına gidin."
          primaryAction={{ label: "Wellness arşivi", href: archiveHref }}
          compact
        />
      )}
      <p className={`${uiBrandingClasses.kpi.cardHint} mt-auto text-[10px] font-bold`}>
        Derin analiz:{" "}
        <a href="#performans-analitigi" className={`${INLINE_LINK_CLASS} underline-offset-2`}>
          Performans analitiği
        </a>
      </p>
    </aside>
  );
}

export default AthleteWellnessSection;
