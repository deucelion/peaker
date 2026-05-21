"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, MapPin, User, User2, Users } from "lucide-react";
import { formatLessonDateTimeTr } from "@/lib/forms/datetimeLocal";
import type { WeeklyLessonScheduleItem } from "@/lib/types";
import { resolveWeeklyPrivateCompleteUi } from "@/lib/privateLessons/completeSessionPolicy";
import { CompactModalFooter } from "@/components/mobile/CompactModalFooter";
import { lessonStatusLabelTr } from "../_utils/scheduleGrid";

/**
 * Faz 6.1 — Seçili ders detay modalı.
 * Davranış: parent state container yönetir; modal yalnızca render + callbacks.
 */
export function LessonDetailModal({
  selected,
  appTz,
  actionBusyId,
  onClose,
  onCancel,
  onHardDelete,
  onMarkCompleted,
}: {
  selected: WeeklyLessonScheduleItem;
  appTz: string;
  actionBusyId: string | null;
  onClose: () => void;
  onCancel: (item: WeeklyLessonScheduleItem) => void;
  onHardDelete: (item: WeeklyLessonScheduleItem) => void;
  onMarkCompleted: (item: WeeklyLessonScheduleItem) => void | Promise<void>;
}) {
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const completeUi = useMemo(
    () => (selected.sourceType === "private" ? resolveWeeklyPrivateCompleteUi(selected) : null),
    [selected]
  );
  const busy = actionBusyId === selected.id;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[min(92dvh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#17171d] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.95)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
              selected.sourceType === "group"
                ? "border-indigo-400/40 bg-indigo-500/10 text-indigo-200"
                : "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
            }`}
          >
            {selected.sourceType === "group" ? "Grup Dersi" : "Özel Ders"}
          </span>
          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-300">
            {lessonStatusLabelTr(selected.status)}
          </span>
          {completeUi?.showCompletedBadge ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase text-emerald-200">
              <CheckCircle2 size={12} aria-hidden /> Ders yapıldı
            </span>
          ) : null}
        </div>
        <h3 className="mt-3 text-xl font-black uppercase tracking-tight text-white">{selected.title}</h3>
        <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
          {selected.sourceType === "group" ? "Grup dersi oturumu" : "Özel ders oturumu"}
        </p>
        {selected.subtitle ? <p className="mt-2 text-sm font-bold text-gray-400">{selected.subtitle}</p> : null}

        <div className="mt-4 grid gap-2 rounded-xl border border-white/10 bg-black/20 p-4 text-[12px] font-bold text-gray-300">
          <p className="flex items-center gap-2">
            <Clock3 size={14} aria-hidden className="text-[#c4b5fd]" />
            {formatLessonDateTimeTr(selected.startsAt, appTz)} – {formatLessonDateTimeTr(selected.endsAt, appTz)}
          </p>
          <p className="flex items-center gap-2">
            <User2 size={14} aria-hidden className="text-[#c4b5fd]" />
            Koç: {selected.coachName || "Koç atanmadı"}
          </p>
          <p className="flex items-center gap-2">
            {selected.sourceType === "group" ? (
              <Users size={14} aria-hidden className="text-[#c4b5fd]" />
            ) : (
              <User size={14} aria-hidden className="text-[#c4b5fd]" />
            )}
            Ders tipi: {selected.sourceType === "group" ? "Grup Dersi" : "Özel Ders"}
          </p>
          <p className="flex items-center gap-2">
            <Users size={14} aria-hidden className="text-[#c4b5fd]" />
            Katılımcı: {selected.participantCount}
          </p>
          <p className="flex items-center gap-2">
            <MapPin size={14} aria-hidden className="text-[#c4b5fd]" />
            {selected.location || "Lokasyon yok"}
          </p>
          {selected.sourceType === "private" && selected.packageRemainingLessons != null ? (
            <p className="text-[10px] font-black uppercase text-gray-500">
              Paket kalan ders: {selected.packageRemainingLessons}
            </p>
          ) : null}
        </div>

        <div className="mt-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Sporcu listesi</p>
          <p className="mt-1 text-sm font-bold text-gray-300">
            {selected.participantNames.length > 0 ? selected.participantNames.join(", ") : "Katılımcı yok"}
          </p>
        </div>

        {selected.note ? (
          <div className="mt-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Not</p>
            <p className="mt-1 text-sm font-bold text-gray-300">{selected.note}</p>
          </div>
        ) : null}

        {confirmCompleteOpen ? (
          <div className="mt-5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4">
            <p className="text-sm font-black text-white">Bu özel dersi yapıldı olarak işaretlemek istiyor musunuz?</p>
            <p className="mt-2 text-[11px] font-bold text-gray-400">
              Bu işlem sporcunun özel ders paketinden 1 ders hakkı düşer.
            </p>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmCompleteOpen(false)}
                disabled={busy}
                className="ui-btn-ghost min-h-10 px-4 text-[10px]"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmCompleteOpen(false);
                  void onMarkCompleted(selected);
                }}
                disabled={busy}
                className="min-h-10 rounded-lg border border-emerald-500/40 bg-emerald-600 px-4 py-2 text-[10px] font-black uppercase tracking-wide text-white disabled:opacity-50"
              >
                Evet, yapıldı olarak işaretle
              </button>
            </div>
          </div>
        ) : null}

        </div>
        <CompactModalFooter>
          {completeUi?.showButton ? (
            <span className="inline-flex shrink-0" title={completeUi.disabledReason ?? undefined}>
              <button
                type="button"
                onClick={() => setConfirmCompleteOpen(true)}
                disabled={busy || !completeUi.canSubmit}
                className="min-h-10 rounded-lg border border-emerald-500/35 bg-emerald-600/90 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                Yapıldı işaretle
              </button>
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => onCancel(selected)}
            disabled={busy || selected.status === "cancelled" || selected.status === "completed"}
            className="shrink-0 rounded-lg border border-amber-400/30 bg-amber-500/15 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-amber-100 disabled:opacity-50"
          >
            İptal
          </button>
          {selected.sourceType === "group" ? (
            <button
              type="button"
              onClick={() => onHardDelete(selected)}
              disabled={busy}
              className="shrink-0 rounded-lg border border-rose-500/40 bg-rose-500/20 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-rose-100 disabled:opacity-50"
            >
              Sil
            </button>
          ) : null}
          <button type="button" onClick={onClose} className="ui-btn-ghost min-h-10 shrink-0 px-3 text-[10px]">
            Kapat
          </button>
          <Link href={selected.detailHref} className="ui-btn-primary min-h-10 shrink-0 px-4 text-[10px]">
            Detay
          </Link>
        </CompactModalFooter>
      </div>
    </div>
  );
}

export default LessonDetailModal;
