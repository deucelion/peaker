"use client";

import { memo, useMemo } from "react";
import { formatLessonTimeTr } from "@/lib/forms/datetimeLocal";
import { isoToZonedDateKey, wallClockInZoneToUtcIso } from "@/lib/schedule/scheduleWallTime";
import type { WeeklyLessonScheduleItem } from "@/lib/types";
import {
  GRID_CONTAINER_HEIGHT_REM,
  GRID_START_HOUR,
  computeDayOverlapLayout,
  dayTitle,
  itemTopAndHeight,
  type DayLayoutItem,
} from "../_utils/scheduleGrid";
import { WeeklyLessonCard } from "./WeeklyLessonCard";
import { WeeklyNowLine } from "./WeeklyNowLine";
import { WeeklyRecentCreatedPulse } from "./WeeklyRecentCreatedPulse";

/**
 * Faz 6.1 — Haftalık takvim grid'i (desktop only).
 * Faz 12.5 — Render hot-path decompose:
 *   - "Şu an" çizgisi izole leaf (`WeeklyNowLine`); dakika tick'leri artık
 *     grid'i rerender ettirmez.
 *   - "Yeni oluşturuldu" pulse'u izole leaf (`WeeklyRecentCreatedPulse`).
 *   - Lesson card'lar memo'lu `WeeklyLessonCard` üzerinden; aynı snapshot'ta
 *     `actionBusyId` veya `recentCreatedRange` değişirse de yalnızca etkilenen
 *     kart rerender olur.
 *
 * Davranış birebir korunur (lane layout, compact rule, group overlap modal).
 */

export type WeeklyScheduleGridProps = {
  shownDayStarts: string[];
  focusedDayKey: string | null;
  todayKey: string;
  weekContainsToday: boolean;
  hourRows: number[];
  itemsByDay: Map<string, WeeklyLessonScheduleItem[]>;
  appTz: string;
  recentCreatedRange:
    | { dayKey: string; startMinutes: number; endMinutes: number; expiresAt: number }
    | null;
  actionBusyId: string | null;
  onSelectItem: (item: WeeklyLessonScheduleItem) => void;
  onFocusDay: (dayKey: string) => void;
  onAnchorQuickCreate: (date: Date) => void;
  onOpenOverlap: (title: string, items: WeeklyLessonScheduleItem[]) => void;
  onQuickCancel: (item: WeeklyLessonScheduleItem) => void;
  onQuickHardDelete: (item: WeeklyLessonScheduleItem) => void;
};

function WeeklyScheduleGridImpl({
  shownDayStarts,
  focusedDayKey,
  todayKey,
  weekContainsToday,
  hourRows,
  itemsByDay,
  appTz,
  recentCreatedRange,
  actionBusyId,
  onSelectItem,
  onFocusDay,
  onAnchorQuickCreate,
  onOpenOverlap,
  onQuickCancel,
  onQuickHardDelete,
}: WeeklyScheduleGridProps) {
  // Faz 12.5 — Day-key cache: `isoToZonedDateKey` her render'da N×~7 kez
  // çağrılıyordu; itemsByDay aynıyken stable referansla yeniden hesaplamayı
  // önler.
  const dayKeys = useMemo(
    () => shownDayStarts.map((iso) => isoToZonedDateKey(iso, appTz)),
    [shownDayStarts, appTz]
  );

  return (
    <div className="ui-table-shell mt-5 hidden overflow-x-auto md:block">
      <div className="min-w-[1120px]">
        <div
          className="ui-table-head--divided grid border-b"
          style={{
            gridTemplateColumns: `88px repeat(${shownDayStarts.length}, minmax(140px, 1fr))`,
          }}
        >
          <div className="sticky left-0 z-30 ui-table-head--filled px-2 py-3 text-[10px] font-black uppercase tracking-widest text-gray-500">
            Saat
          </div>
          {shownDayStarts.map((dayIso, dayIdx) => {
            const dayKey = dayKeys[dayIdx];
            const isToday = dayKey === todayKey;
            return (
              <div
                key={dayIso}
                onClick={() => onFocusDay(dayKey)}
                className={`border-l px-3 py-3 text-[11px] font-black uppercase tracking-wide ${
                  isToday
                    ? "border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_45%,transparent)] bg-gradient-to-b from-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_18%,transparent)] to-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_6%,transparent)] text-[color:var(--peaker-ui-PRIMARY)]"
                    : "ui-card-inner text-white/90"
                } ${focusedDayKey ? "cursor-default" : "cursor-pointer sm:hover:ui-kpi-band"}`}
              >
                {dayTitle(dayIso, appTz)}
                {isToday ? (
                  <span className="ml-2 rounded-md border border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_45%,transparent)] ui-kpi-chip--brand px-1.5 py-0.5 text-[9px]">
                    Bugün
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `88px repeat(${shownDayStarts.length}, minmax(140px, 1fr))`,
          }}
        >
          <WeeklyNowLine appTz={appTz} weekContainsToday={weekContainsToday} />

          <div className="sticky left-0 z-20 relative border-r ui-table-head--filled">
            {hourRows.map((h) => (
              <div
                key={h}
                className={`h-16 border-b px-2 pt-1 text-[10px] font-black tabular-nums ${
                  h % 2 === 0 ? "ui-kpi-band text-gray-300" : "text-gray-500"
                }`}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {shownDayStarts.map((dayIso, dayIdx) => {
            const dayKey = dayKeys[dayIdx];
            const rows = itemsByDay.get(dayKey) || [];
            const laidOutRows = computeDayOverlapLayout(rows);

            // Group-collapse: focusedDayKey yokken 3+ overlapping lesson olunca
            // ikincil ders'ler "+N ders" rozetinde toplanır.
            const grouped = new Map<string, DayLayoutItem[]>();
            for (const row of laidOutRows) {
              const key = row.groupId;
              const prev = grouped.get(key) || [];
              prev.push(row);
              grouped.set(key, prev);
            }

            const renderRows: Array<
              { kind: "lesson"; row: DayLayoutItem } | { kind: "group"; rows: DayLayoutItem[] }
            > = [];
            for (const rowsInGroup of grouped.values()) {
              const ordered = [...rowsInGroup].sort((a, b) => a.laneIndex - b.laneIndex);
              const shouldCompact = !focusedDayKey && (ordered[0]?.groupSize || 0) > 2;
              if (shouldCompact) {
                if (ordered[0])
                  renderRows.push({
                    kind: "lesson",
                    row: { ...ordered[0], laneIndex: 0, laneCount: 2 },
                  });
                renderRows.push({ kind: "group", rows: ordered.slice(1) });
              } else {
                for (const row of ordered) renderRows.push({ kind: "lesson", row });
              }
            }

            return (
              <div
                key={dayIso}
                className={`relative border-r last:border-r-0 ${
                  dayKey === todayKey
                    ? "border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_6%,transparent)]"
                    : "ui-card-inner"
                }`}
                style={{ height: `${GRID_CONTAINER_HEIGHT_REM}rem` }}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest("[data-lesson-card='1']")) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const y = e.clientY - rect.top;
                  const totalRows = hourRows.length;
                  const rowHeight = rect.height / totalRows;
                  const rowIndex = Math.max(
                    0,
                    Math.min(totalRows - 1, Math.floor(y / rowHeight))
                  );
                  const selectedHour = GRID_START_HOUR + rowIndex;
                  const anchorIso = wallClockInZoneToUtcIso(
                    dayKey,
                    `${String(selectedHour).padStart(2, "0")}:00`,
                    appTz
                  );
                  if (anchorIso) onAnchorQuickCreate(new Date(anchorIso));
                }}
              >
                <WeeklyRecentCreatedPulse range={recentCreatedRange} targetDayKey={dayKey} />
                {hourRows.map((h) => (
                  <div
                    key={h}
                    className={`h-16 border-b ${
                      h % 2 === 0
                        ? "ui-kpi-band"
                        : "border-[color:color-mix(in_srgb,var(--peaker-ui-TEXT_SECONDARY,#6b7280)_8%,transparent)]"
                    }`}
                  />
                ))}
                {renderRows.map((entry, idx) => {
                  if (entry.kind === "group") {
                    const anchor = entry.rows[0];
                    const { top, height } = itemTopAndHeight(anchor.item, appTz);
                    return (
                      <button
                        key={`group-${dayKey}-${idx}`}
                        type="button"
                        onClick={() => {
                          onOpenOverlap(
                            `${dayTitle(dayIso, appTz)} · ${formatLessonTimeTr(
                              anchor.item.startsAt,
                              appTz
                            )} - ${formatLessonTimeTr(anchor.item.endsAt, appTz)}`,
                            entry.rows.map((r) => r.item)
                          );
                        }}
                        className="absolute rounded-2xl border border-amber-300/40 bg-amber-500/20 px-2 py-2 text-left text-[10px] font-black uppercase tracking-wide text-amber-50"
                        style={{
                          top: `${top}%`,
                          height: `${height}%`,
                          width: "calc(50% - 0.5rem)",
                          left: "calc(50% + 0.25rem)",
                        }}
                      >
                        +{entry.rows.length} ders
                      </button>
                    );
                  }

                  const { item, laneIndex, laneCount } = entry.row;
                  return (
                    <WeeklyLessonCard
                      key={`${item.sourceType}-${item.id}`}
                      item={item}
                      laneIndex={laneIndex}
                      laneCount={laneCount}
                      isCompactCardHint={!focusedDayKey && laneCount > 1}
                      appTz={appTz}
                      actionBusyId={actionBusyId}
                      onSelectItem={onSelectItem}
                      onQuickCancel={onQuickCancel}
                      onQuickHardDelete={onQuickHardDelete}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Faz 11.5 + Faz 12.5 — memo: now/nowTop kaldırıldı → snapshot/range stable
// olduğu sürece grid hiç rerender olmaz; saat tick'i izole leaf'te yaşar.
export const WeeklyScheduleGrid = memo(WeeklyScheduleGridImpl);
export default WeeklyScheduleGrid;
