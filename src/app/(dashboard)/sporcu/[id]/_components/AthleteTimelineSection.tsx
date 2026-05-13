"use client";

import { useState } from "react";
import EmptyState from "@/components/ui/EmptyState";
import { LoadMoreButton } from "@/components/ui/data-display";

export type TimelineEvent = {
  id: string;
  type: "lesson" | "payment" | "injury" | "note";
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
      className="rounded-2xl border border-white/5 bg-[#121215] p-5 shadow-xl md:rounded-3xl md:p-7"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-wide text-white">Operasyon timeline</h2>
        <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">
          Ders · Ödeme · Sakatlık · Not
        </span>
      </div>
      {events.length === 0 ? (
        <EmptyState
          variant="no_data"
          title="Timeline boş"
          description="Sporcu için ders, ödeme veya sakatlık aktivitesi kaydedilmemiş."
          primaryAction={{ label: "Ders planla", href: "/dersler" }}
          secondaryAction={{ label: "Finans ekranı", href: emptyFinanceHref || "/finans" }}
          compact
        />
      ) : (
        <ul className="space-y-2">
          {visibleEvents.map((event) => (
            <li
              key={event.id}
              className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-[11px] font-bold"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-white">{event.title}</p>
                <span className="text-gray-500">{new Date(event.at).toLocaleString("tr-TR")}</span>
              </div>
              <p className="mt-1 text-gray-400">{event.detail}</p>
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
