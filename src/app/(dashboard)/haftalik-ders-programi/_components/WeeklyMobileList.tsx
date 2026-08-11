"use client";

import { memo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { formatLessonTimeTr } from "@/lib/forms/datetimeLocal";
import { isoToZonedDateKey } from "@/lib/schedule/scheduleWallTime";
import type { WeeklyLessonScheduleItem } from "@/lib/types";
import { dayTitle } from "../_utils/scheduleGrid";

/**
 * Faz 6.1 — Mobil ekran için gün-gün ders listesi.
 * Faz 12.5 — Virtualization:
 *   - Tek günde ders sayısı VIRTUALIZE_THRESHOLD altındaysa eski davranış
 *     (basit map + tüm DOM elemanları); UX değişmiyor.
 *   - Tek günde ders ≥ VIRTUALIZE_THRESHOLD ise `@tanstack/react-virtual`
 *     devreye girer; iç scroll container açılır ve yalnızca görünür satırlar
 *     DOM'a basılır. Bu, stres senaryolarında (örn. süper-admin perspektifinden
 *     büyük org haftası) hem ilk paint hem scroll FPS açısından kritik.
 *
 * Davranış parity:
 *   - Item action'ı aynı (onSelect callback).
 *   - Item card markup aynı (taşındı ama görsel değişmedi).
 *   - Sticky day header (section başlığı) korunur.
 */

const VIRTUALIZE_THRESHOLD = 40;
const ROW_ESTIMATED_HEIGHT = 92;
const VIRTUAL_CONTAINER_MAX_HEIGHT = 480;
const OVERSCAN = 6;

export type WeeklyMobileListProps = {
  shownDayStarts: string[];
  itemsByDay: Map<string, WeeklyLessonScheduleItem[]>;
  appTz: string;
  onSelect: (item: WeeklyLessonScheduleItem) => void;
};

function MobileLessonRowImpl({
  item,
  appTz,
  onSelect,
}: {
  item: WeeklyLessonScheduleItem;
  appTz: string;
  onSelect: (item: WeeklyLessonScheduleItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="w-full rounded-xl ui-card-inner p-3 text-left"
    >
      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
        {item.sourceType === "group" ? "Grup Dersi" : "Özel Ders"} ·{" "}
        {formatLessonTimeTr(item.startsAt, appTz)}
      </p>
      <p className="mt-1 text-sm font-black text-white">{item.title}</p>
      <p className="text-[11px] font-semibold text-gray-300">
        Koç: {item.coachName || "Koç atanmadı"}
      </p>
      <p className="text-[11px] font-bold text-gray-500">
        Lokasyon: {item.location || "Lokasyon belirtilmedi"}
      </p>
    </button>
  );
}
const MobileLessonRow = memo(MobileLessonRowImpl);

function VirtualizedDayRows({
  rows,
  appTz,
  onSelect,
}: {
  rows: WeeklyLessonScheduleItem[];
  appTz: string;
  onSelect: (item: WeeklyLessonScheduleItem) => void;
}) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  // React Compiler tanstack-virtual'i tanımıyor; bu hook'un dönüşleri
  // imperatif/yan etkilidir ve compiler bunu memoize edemez. Bilinçli olarak
  // skip ediyoruz; manuel olarak parent state'i stable tutuyoruz (rows,
  // appTz, onSelect referansları).
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_ESTIMATED_HEIGHT,
    overscan: OVERSCAN,
  });

  return (
    <div
      ref={parentRef}
      className="mt-3 max-h-[480px] overflow-y-auto rounded-xl border border-white/5 ui-card-inner"
      style={{ maxHeight: `${VIRTUAL_CONTAINER_MAX_HEIGHT}px` }}
      role="list"
      aria-label="Ders listesi (sanallaştırılmış)"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: "relative",
          width: "100%",
        }}
      >
        {virtualizer.getVirtualItems().map((vi) => {
          const item = rows[vi.index];
          return (
            <div
              key={`${item.sourceType}-${item.id}`}
              role="listitem"
              data-index={vi.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vi.start}px)`,
                padding: "4px 8px",
              }}
            >
              <MobileLessonRow item={item} appTz={appTz} onSelect={onSelect} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeeklyMobileListImpl({
  shownDayStarts,
  itemsByDay,
  appTz,
  onSelect,
}: WeeklyMobileListProps) {
  return (
    <div className="mt-5 grid gap-3 md:hidden">
      {shownDayStarts.map((dayIso) => {
        const dayKey = isoToZonedDateKey(dayIso, appTz);
        const rows = itemsByDay.get(dayKey) || [];
        const useVirtual = rows.length >= VIRTUALIZE_THRESHOLD;
        return (
          <section key={dayIso} className="ui-card p-4">
            <h2 className="text-xs font-black uppercase tracking-wide text-white">
              {dayTitle(dayIso, appTz)}
              {rows.length > 0 ? (
                <span className="ml-2 rounded-md border border-white/5 ui-kpi-band px-1.5 py-0.5 text-[9px] font-bold text-white/80">
                  {rows.length} ders
                </span>
              ) : null}
            </h2>
            {rows.length === 0 ? (
              <p className="mt-2 text-[11px] font-bold text-gray-500">Ders yok.</p>
            ) : useVirtual ? (
              <VirtualizedDayRows rows={rows} appTz={appTz} onSelect={onSelect} />
            ) : (
              <div className="mt-3 space-y-2">
                {rows.map((item) => (
                  <MobileLessonRow
                    key={`${item.sourceType}-${item.id}`}
                    item={item}
                    appTz={appTz}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

export const WeeklyMobileList = memo(WeeklyMobileListImpl);
export default WeeklyMobileList;
