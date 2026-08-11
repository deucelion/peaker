"use client";

import { useState } from "react";
import EmptyState from "@/components/ui/EmptyState";
import { LoadMoreButton } from "@/components/ui/data-display";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";

export type TimelineEvent = {
  id: string;
  type: "lesson" | "payment" | "injury" | "note" | "finance_movement";
  at: string;
  title: string;
  detail: string;
};

const TIMELINE_PAGE_SIZE = 50;

/**
 * Faz 6.4 — Operasyon timeline'ı (paginated).
 *
 * Önceki davranış: ilk 60 kayıt gösteriliyordu, daha fazlası görünmüyordu.
 * Yeni davranış: ilk 50 kayıt gösterilir, "Daha fazla yükle" ile +50 ekleyerek
 * tam listeye çıkılabilir. Faz 6.4 pagination iyileştirmesi.
 */
export function AthleteTimelineSection({
  events,
  emptyFinanceHref,
}: {
  events: TimelineEvent[];
  emptyFinanceHref?: string;
}) {
  const [visibleCount, setVisibleCount] = useState(TIMELINE_PAGE_SIZE);
  const visibleEvents = events.slice(0, visibleCount);
  const remaining = events.length - visibleEvents.length;
  return (
    <section
      id="operasyon-zaman-cizelgesi"
      className={`${uiBrandingClasses.card.base} rounded-2xl p-5 shadow-xl md:rounded-3xl md:p-7`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className={`${uiBrandingClasses.typography.h2Sm} text-sm tracking-wide`}>
          Operasyon ve finans zaman çizelgesi
        </h2>
        <span className={`${uiBrandingClasses.kpi.cardHint} text-[9px] font-black uppercase tracking-widest`}>
          Ders · Tahsilat · Paket olayları · Görüşme
        </span>
      </div>
      {events.length === 0 ? (
        <EmptyState
          variant="no_data"
          title="Timeline boş"
          description="Sporcu için ders, tahsilat kaydı veya sakatlık aktivitesi kaydedilmemiş."
          primaryAction={{ label: "Ders planla", href: "/dersler" }}
          secondaryAction={{ label: "Finans ekranı", href: emptyFinanceHref || "/finans" }}
          compact
        />
      ) : (
        <ul className="space-y-2">
          {visibleEvents.map((event) => (
            <li
              key={event.id}
              className={`${uiBrandingClasses.card.inner} px-4 py-3 text-[11px] font-bold`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={uiBrandingClasses.kpi.cardValue}>{event.title}</p>
                <span className={uiBrandingClasses.kpi.cardHint}>
                  {new Date(event.at).toLocaleString("tr-TR")}
                </span>
              </div>
              <p className={`${uiBrandingClasses.typography.body} mt-1 text-[11px]`}>{event.detail}</p>
            </li>
          ))}
        </ul>
      )}
      {remaining > 0 ? (
        <LoadMoreButton
          loaded={visibleEvents.length}
          total={events.length}
          loading={false}
          onClick={() => setVisibleCount((c) => c + TIMELINE_PAGE_SIZE)}
        />
      ) : null}
    </section>
  );
}

export default AthleteTimelineSection;
