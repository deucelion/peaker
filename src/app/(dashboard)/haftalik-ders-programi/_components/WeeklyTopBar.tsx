"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { getWeekStartMondayIso } from "@/lib/schedule/weeklySchedule";
import type { WeeklyLessonScheduleSnapshot, WeeklyLessonTypeFilter } from "@/lib/types";
import { utcDateKeyFromIso } from "../_utils/scheduleGrid";
import { SelectPremium } from "./SelectPremium";

/**
 * Faz 6.1 — Sayfa üst bandı: hafta navigasyonu + ders tipi/koç/lokasyon filtreleri + özet.
 * Davranışsız wrapper; tüm state parent'tan props ile geliyor.
 */
export function WeeklyTopBar({
  weekStart,
  weekLabel,
  lessonType,
  coachId,
  location,
  snapshot,
  locationOptions,
  selectedLocationColor,
  summary,
  onWeekStartChange,
  onShiftWeek,
  onLessonTypeChange,
  onCoachIdChange,
  onLocationChange,
}: {
  weekStart: string;
  weekLabel: string;
  lessonType: WeeklyLessonTypeFilter;
  coachId: string;
  location: string;
  snapshot: WeeklyLessonScheduleSnapshot | null;
  locationOptions: Array<{ id: string; name: string; color: string }>;
  selectedLocationColor: string | null;
  summary: { totalLessons: number; groupLessons: number; privateLessons: number; activeCoachCount: number };
  onWeekStartChange: (next: string) => void;
  onShiftWeek: (days: number) => void;
  onLessonTypeChange: (next: WeeklyLessonTypeFilter) => void;
  onCoachIdChange: (next: string) => void;
  onLocationChange: (next: string) => void;
}) {
  return (
    <header className="flex min-w-0 flex-col gap-4 border-b border-white/5 pb-6">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">Operasyon ekranı</p>
        <h1 className="ui-h1">
          Haftalık <span className="text-[#7c3aed]">ders programı</span>
        </h1>
        <p className="ui-lead max-w-3xl break-words normal-case tracking-normal">
          Grup dersleri ve özel ders planlarını tek çizelgede görün. Filtrelerle haftayı, dersi ve koçu daraltın.
        </p>
      </div>

      <div className="grid gap-2 rounded-2xl border border-white/10 bg-gradient-to-br from-[#121215] to-[#171721] p-3 shadow-[0_8px_26px_-22px_rgba(124,58,237,0.45)] lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="mb-1 text-[9px] font-black uppercase tracking-wider text-gray-500">Hafta</p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onShiftWeek(-7)}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 px-2.5 text-gray-300 sm:hover:bg-white/5"
              aria-label="Önceki hafta"
            >
              <ChevronLeft size={16} aria-hidden />
            </button>
            <input
              type="date"
              value={utcDateKeyFromIso(weekStart)}
              onChange={(e) => onWeekStartChange(getWeekStartMondayIso(e.target.value))}
              className="ui-input min-h-10"
            />
            <button
              type="button"
              onClick={() => onShiftWeek(7)}
              className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 px-2.5 text-gray-300 sm:hover:bg-white/5"
              aria-label="Sonraki hafta"
            >
              <ChevronRight size={16} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => onWeekStartChange(getWeekStartMondayIso())}
              className="inline-flex min-h-10 items-center rounded-xl border border-[#7c3aed]/50 bg-[#7c3aed]/25 px-2.5 text-[10px] font-black uppercase tracking-wide text-[#e8ddff] transition sm:hover:bg-[#7c3aed]/35"
            >
              Bu hafta
            </button>
          </div>
          <p className="mt-1 text-[10px] font-bold text-gray-500">{weekLabel}</p>
        </div>

        <div className="lg:col-span-4">
          <SelectPremium
            label="Ders tipi"
            value={lessonType}
            onChange={(next) => onLessonTypeChange(next as WeeklyLessonTypeFilter)}
          >
            <option value="all">Hepsi</option>
            <option value="group">Sadece grup dersleri</option>
            <option value="private">Sadece özel dersler</option>
          </SelectPremium>
        </div>

        <div className="lg:col-span-2">
          <SelectPremium label="Koç" value={coachId} onChange={onCoachIdChange}>
            <option value="">Tüm koçlar</option>
            {(snapshot?.coachOptions || []).map((coach) => (
              <option key={coach.id} value={coach.id}>
                {coach.full_name}
              </option>
            ))}
          </SelectPremium>
        </div>

        <label className="lg:col-span-1">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">Lokasyon</span>
          <div className="relative">
            <select
              value={location}
              onChange={(e) => onLocationChange(e.target.value)}
              className="ui-select min-h-10 w-full appearance-none rounded-xl border-white/10 bg-[#17171f] pr-10"
            >
              <option value="">Tüm lokasyonlar</option>
              {locationOptions.map((loc) => (
                <option key={loc.id} value={loc.name}>
                  {loc.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              aria-hidden
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#c4b5fd]"
            />
            {selectedLocationColor ? (
              <span
                className="pointer-events-none absolute right-8 top-1/2 size-2.5 -translate-y-1/2 rounded-full border border-white/40"
                style={{ backgroundColor: selectedLocationColor }}
                aria-hidden
              />
            ) : null}
          </div>
          {locationOptions.length === 0 ? (
            <p className="mt-1 text-[10px] font-bold text-amber-300/90">
              Tanımlı lokasyon yok. Hızlı planlama penceresinden lokasyon ekleyin.
            </p>
          ) : null}
        </label>
      </div>

      <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-white/10 bg-[#111117] p-2 sm:grid-cols-4">
        <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5">
          <p className="text-[8px] font-black uppercase tracking-wider text-gray-500">Toplam Ders</p>
          <p className="mt-0.5 text-base font-black tabular-nums text-white">{summary.totalLessons}</p>
        </div>
        <div className="rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-2.5 py-1.5">
          <p className="text-[8px] font-black uppercase tracking-wider text-indigo-200/80">Grup Dersi</p>
          <p className="mt-0.5 text-base font-black tabular-nums text-indigo-100">{summary.groupLessons}</p>
        </div>
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1.5">
          <p className="text-[8px] font-black uppercase tracking-wider text-emerald-200/80">Özel Ders</p>
          <p className="mt-0.5 text-base font-black tabular-nums text-emerald-100">{summary.privateLessons}</p>
        </div>
        <div className="rounded-lg border border-[#7c3aed]/30 bg-[#7c3aed]/10 px-2.5 py-1.5">
          <p className="text-[8px] font-black uppercase tracking-wider text-[#d8cbff]/85">Aktif Koç</p>
          <p className="mt-0.5 text-base font-black tabular-nums text-[#f0e9ff]">{summary.activeCoachCount}</p>
        </div>
      </div>
    </header>
  );
}

export default WeeklyTopBar;
