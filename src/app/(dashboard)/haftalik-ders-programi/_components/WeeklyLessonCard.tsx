"use client";

import { memo } from "react";
import Link from "next/link";
import { MapPin, User, User2, Users } from "lucide-react";
import { formatLessonTimeTr } from "@/lib/forms/datetimeLocal";
import type { WeeklyLessonScheduleItem } from "@/lib/types";
import { itemTopAndHeight, locationCardStyle } from "../_utils/scheduleGrid";

/**
 * Faz 12.5 — Memoized lesson card.
 *
 * WeeklyScheduleGrid içinde inline render edilen kart bloğu burada ayrı bir
 * memo component. Faydaları:
 *   - `now` minute tick'ler grid'i rerender ettirse bile, kart referansları
 *     değişmediği sürece kart DOM'u yeniden hesaplanmaz.
 *   - 100+ ders olan haftalarda dakika başına frame budget düşer.
 *   - Card davranışı bire bir korunur; sadece taşıma + memoization.
 *
 * Stable references gereksinimleri (parent tarafında):
 *   - onSelectItem, onQuickCancel, onQuickHardDelete: stable callback referansları
 *     yoksa useCallback kullanılmalı (page.tsx zaten useCallback ile sarmalanmış).
 *   - item: snapshot yeniden fetch edilirse referans değişir; bu durumda
 *     rerender beklenir ve doğru.
 */

export type WeeklyLessonCardProps = {
  item: WeeklyLessonScheduleItem;
  laneIndex: number;
  laneCount: number;
  isCompactCardHint: boolean;
  appTz: string;
  actionBusyId: string | null;
  onSelectItem: (item: WeeklyLessonScheduleItem) => void;
  onQuickCancel: (item: WeeklyLessonScheduleItem) => void;
  onQuickHardDelete: (item: WeeklyLessonScheduleItem) => void;
};

function WeeklyLessonCardImpl({
  item,
  laneIndex,
  laneCount,
  isCompactCardHint,
  appTz,
  actionBusyId,
  onSelectItem,
  onQuickCancel,
  onQuickHardDelete,
}: WeeklyLessonCardProps) {
  const { top, height } = itemTopAndHeight(item, appTz);
  const isGroup = item.sourceType === "group";
  const coachLabel = item.coachName || "Koç atanmadı";
  const locationLabel = item.location || "Lokasyon belirtilmedi";
  const isCompactCard = isCompactCardHint || laneCount > 1 || height < 11;
  const widthPercent = 100 / laneCount;
  const leftPercent = laneIndex * widthPercent;
  const locationStyle = locationCardStyle(item.locationColor);

  return (
    <div
      onClick={() => onSelectItem(item)}
      data-lesson-card="1"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectItem(item);
        }
      }}
      title={`${isGroup ? "Grup Dersi" : "Özel Ders"} | ${item.title} | ${formatLessonTimeTr(item.startsAt, appTz)} - ${formatLessonTimeTr(item.endsAt, appTz)} | Koç: ${coachLabel}${item.location ? ` | Lokasyon: ${item.location}` : ""}`}
      className={`group absolute min-h-[60px] overflow-hidden rounded-2xl border px-2 py-2 text-left shadow-[0_12px_28px_-16px_rgba(0,0,0,0.95)] transition-all duration-150 sm:hover:-translate-y-0.5 ${
        locationStyle
          ? "text-white"
          : isGroup
            ? "border-indigo-400/55 bg-gradient-to-b from-indigo-500/22 to-indigo-500/14 text-indigo-50 sm:hover:shadow-[0_0_0_1px_rgba(129,140,248,0.55),0_18px_30px_-16px_rgba(99,102,241,0.9)]"
            : "border-emerald-400/55 border-dashed bg-gradient-to-b from-emerald-500/22 to-emerald-500/14 text-emerald-50 sm:hover:shadow-[0_0_0_1px_rgba(52,211,153,0.55),0_18px_30px_-16px_rgba(16,185,129,0.9)]"
      }`}
      style={{
        top: `${top}%`,
        height: `${height}%`,
        width: `calc(${widthPercent}% - 0.5rem)`,
        left: `calc(${leftPercent}% + 0.25rem)`,
        ...(locationStyle || {}),
      }}
    >
      {item.locationColor ? (
        <span
          className="absolute left-0 top-0 h-full w-1.5 rounded-l-2xl opacity-90"
          style={{ backgroundColor: item.locationColor }}
          aria-hidden
        />
      ) : null}
      <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider">
        {isGroup ? <Users size={11} aria-hidden /> : <User size={11} aria-hidden />}
        <span
          className={`rounded px-1 py-0.5 ${
            isGroup ? "bg-indigo-950/45 text-indigo-100" : "bg-emerald-950/45 text-emerald-100"
          }`}
        >
          {isGroup ? "Grup Dersi" : "Özel Ders"}
        </span>
      </p>
      <p
        className={`mt-1 overflow-hidden text-[11px] font-black leading-tight text-white ${
          isCompactCard ? "line-clamp-1" : "line-clamp-2"
        }`}
      >
        {item.title}
      </p>
      <p className="mt-1 line-clamp-1 overflow-hidden text-[10px] font-bold text-white/85">
        {formatLessonTimeTr(item.startsAt, appTz)} - {formatLessonTimeTr(item.endsAt, appTz)}
      </p>
      <p
        className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-white/90"
        title={`Koç: ${coachLabel}`}
      >
        <User2 size={11} aria-hidden className="shrink-0 text-white/70" />
        <span className="min-w-0 truncate">Koç: {coachLabel}</span>
      </p>
      {!isCompactCard ? (
        <p className="mt-1 inline-flex max-w-full items-center gap-1 overflow-hidden text-[10px] font-black text-white/85">
          <MapPin size={11} aria-hidden className="shrink-0 text-white/70" />
          <span className="line-clamp-1 overflow-hidden">Lokasyon: {locationLabel}</span>
        </p>
      ) : null}
      <div className="mt-2 hidden flex-wrap gap-1.5 opacity-0 transition group-hover:flex group-hover:opacity-100">
        <Link
          href={item.detailHref}
          className="rounded-md border border-white/20 bg-black/35 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-white/90"
        >
          Detaya Git
        </Link>
        <Link
          href={item.detailHref}
          className="rounded-md border border-white/20 bg-black/35 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-white/90"
        >
          Düzenle
        </Link>
        <Link
          href={
            item.sourceType === "group"
              ? `/antrenman-yonetimi?modul=grup-dersleri&view=yoklama&trainingId=${item.id}`
              : item.detailHref
          }
          className="rounded-md border border-white/20 bg-black/35 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-white/90"
        >
          Yoklama Aç
        </Link>
        <button
          type="button"
          disabled={actionBusyId === item.id}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onQuickCancel(item);
          }}
          className="rounded-md border border-rose-400/40 bg-rose-500/20 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-rose-100 disabled:opacity-50"
        >
          İptal Et
        </button>
        {item.sourceType === "group" ? (
          <button
            type="button"
            disabled={actionBusyId === item.id}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onQuickHardDelete(item);
            }}
            className="rounded-md border border-rose-500/55 bg-rose-600/30 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-rose-50 disabled:opacity-50"
          >
            Kalıcı Sil
          </button>
        ) : null}
      </div>
    </div>
  );
}

export const WeeklyLessonCard = memo(WeeklyLessonCardImpl);
export default WeeklyLessonCard;
