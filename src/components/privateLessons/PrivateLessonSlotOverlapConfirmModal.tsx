"use client";

import { formatLessonTimeTr } from "@/lib/forms/datetimeLocal";
import { SCHEDULE_APP_TIME_ZONE } from "@/lib/schedule/scheduleWallTime";
import type { PrivateLessonSlotOverlapPreviewResult } from "@/lib/privateLessons/privateLessonSlotOverlap";
import {
  coachSlotCapacityMessage,
  formatPrivateLessonSlotOverlapIntro,
} from "@/lib/privateLessons/privateLessonSlotOverlap";
import { CompactModalFooter } from "@/components/mobile/CompactModalFooter";

export function PrivateLessonSlotOverlapConfirmModal({
  preview,
  appTz = SCHEDULE_APP_TIME_ZONE,
  busy,
  onCancel,
  onConfirm,
}: {
  preview: PrivateLessonSlotOverlapPreviewResult;
  appTz?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const timeRange = `${formatLessonTimeTr(preview.slotStartsAt, appTz)} - ${formatLessonTimeTr(preview.slotEndsAt, appTz)}`;
  const capacityMsg = coachSlotCapacityMessage(preview.capacityLevel, preview.totalAfterCreate);
  const isCritical = preview.capacityLevel === "critical";
  const isWarning = preview.capacityLevel === "warning";

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm sm:items-center"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="slot-overlap-title"
        className="flex max-h-[min(92dvh,640px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#17171d] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.95)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#c4b5fd]">Koç slot uyarısı</p>
          <h2 id="slot-overlap-title" className="mt-2 text-base font-black text-white">
            {formatPrivateLessonSlotOverlapIntro(preview.overlappingCount)}
          </h2>
          <p className="mt-3 text-sm font-bold tabular-nums text-gray-200">{timeRange}</p>

          <ul className="mt-4 space-y-1.5 rounded-xl border border-white/10 bg-black/25 p-4 text-sm font-bold text-gray-200">
            {preview.peers.map((peer) => (
              <li key={peer.id} className="flex items-start gap-2">
                <span className="text-emerald-400" aria-hidden>
                  •
                </span>
                <span>{peer.athleteName || "Sporcu"}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-200/80">Yeni kayıt</p>
            <p className="mt-1 flex items-start gap-2 text-sm font-black text-white">
              <span className="text-emerald-400" aria-hidden>
                •
              </span>
              {preview.newAthleteName}
            </p>
          </div>

          {capacityMsg ? (
            <p
              className={`mt-4 rounded-xl border px-4 py-3 text-[11px] font-bold leading-relaxed ${
                isCritical
                  ? "border-red-500/40 bg-red-500/10 text-red-100"
                  : isWarning
                    ? "border-amber-500/35 bg-amber-500/10 text-amber-100"
                    : "border-white/10 bg-white/5 text-gray-300"
              }`}
            >
              {capacityMsg}
            </p>
          ) : null}

          <p className="mt-4 text-sm font-bold text-gray-400">Devam etmek istiyor musunuz?</p>
        </div>
        <CompactModalFooter>
          <button type="button" onClick={onCancel} disabled={busy} className="ui-btn-ghost min-h-10 px-4 text-[10px]">
            İptal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="min-h-10 rounded-lg border border-emerald-500/40 bg-emerald-600 px-4 py-2 text-[10px] font-black uppercase tracking-wide text-white disabled:opacity-50"
          >
            Devam et
          </button>
        </CompactModalFooter>
      </div>
    </div>
  );
}

export default PrivateLessonSlotOverlapConfirmModal;
