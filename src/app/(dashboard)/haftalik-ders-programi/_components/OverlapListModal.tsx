"use client";

import { formatLessonTimeTr } from "@/lib/forms/datetimeLocal";
import type { WeeklyLessonScheduleItem } from "@/lib/types";
import { CheckCircle2 } from "lucide-react";
import { OverlayDialog, OVERLAY_Z, OverlayFooter } from "@/components/ui/overlay";
import { locationCardStyle } from "../_utils/scheduleGrid";

function overlapTimeRangeLabel(items: WeeklyLessonScheduleItem[], appTz: string): string | null {
  if (items.length === 0) return null;
  const first = items[0];
  return `${formatLessonTimeTr(first.startsAt, appTz)} - ${formatLessonTimeTr(first.endsAt, appTz)}`;
}

function privateAthleteLabel(item: WeeklyLessonScheduleItem): string {
  if (item.participantNames.length > 0) return item.participantNames[0];
  return item.title?.trim() || "Özel ders";
}

/**
 * Faz 6.1 / 29.3 — Çakışan dersler listesi modalı.
 */
export function OverlapListModal({
  open,
  title,
  items,
  appTz,
  onClose,
  onSelect,
}: {
  open: boolean;
  title: string;
  items: WeeklyLessonScheduleItem[];
  appTz: string;
  onClose: () => void;
  onSelect: (item: WeeklyLessonScheduleItem) => void;
}) {
  if (!open) return null;

  const allPrivate = items.length > 0 && items.every((i) => i.sourceType === "private");
  const slotRange = allPrivate ? overlapTimeRangeLabel(items, appTz) : null;

  return (
    <OverlayDialog
      open={open}
      onClose={onClose}
      layer={OVERLAY_Z.MODAL_ELEVATED}
      strongBackdrop
      shellClassName="w-full max-w-lg rounded-2xl ui-card p-5 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.95)] !max-w-lg sm:!p-5"
    >
        <p className="text-[10px] font-black uppercase tracking-wider ui-kpi-card__trend">
          {allPrivate ? "Aynı slottaki özel dersler" : "Çakışan dersler"}
        </p>
        <h3 className="mt-2 text-sm font-black text-white">{title}</h3>
        {slotRange ? (
          <p className="mt-2 text-sm font-bold tabular-nums text-emerald-200/90">{slotRange}</p>
        ) : null}

        {allPrivate ? (
          <ul className="mt-4 max-h-[50vh] space-y-2 overflow-y-auto rounded-xl ui-kpi-band p-4">
            {items.map((item) => (
              <li key={`ov-${item.id}`}>
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-bold text-white sm:hover:ui-kpi-band"
                >
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-400" aria-hidden />
                  <span>{privateAthleteLabel(item)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto">
            {items.map((item) => (
              <button
                key={`ov-${item.id}`}
                type="button"
                onClick={() => onSelect(item)}
                className="w-full rounded-xl ui-kpi-band p-3 text-left"
                style={locationCardStyle(item.locationColor)}
              >
                <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
                  {item.sourceType === "group" ? "Grup Dersi" : "Özel Ders"} ·{" "}
                  {formatLessonTimeTr(item.startsAt, appTz)} - {formatLessonTimeTr(item.endsAt, appTz)}
                </p>
                <p className="mt-1 line-clamp-1 text-sm font-black text-white">{item.title}</p>
                <p
                  className="line-clamp-1 text-[11px] font-semibold text-white/90"
                  title={`Koç: ${item.coachName || "Koç atanmadı"}`}
                >
                  Koç: {item.coachName || "Koç atanmadı"}
                </p>
                <p className="line-clamp-1 text-[11px] font-bold text-white/80">
                  Lokasyon: {item.location || "Lokasyon belirtilmedi"}
                </p>
              </button>
            ))}
          </div>
        )}

        <OverlayFooter>
          <button type="button" onClick={onClose} className="ui-btn-ghost min-h-11 px-4">
            Kapat
          </button>
        </OverlayFooter>
    </OverlayDialog>
  );
}

export default OverlapListModal;
