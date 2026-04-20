"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  MapPin,
  User,
  User2,
  Users,
} from "lucide-react";
import Notification from "@/components/Notification";
import { listWeeklyLessonScheduleSnapshot } from "@/lib/actions/snapshotActions";
import { getWeekDayStarts, getWeekStartMondayIso, sameDayKey } from "@/lib/schedule/weeklySchedule";
import type { WeeklyLessonScheduleItem, WeeklyLessonScheduleSnapshot, WeeklyLessonTypeFilter } from "@/lib/types";

const GRID_START_HOUR = 6;
const GRID_END_HOUR = 23;
const DAY_MINUTES = (GRID_END_HOUR - GRID_START_HOUR) * 60;
const GRID_CONTAINER_HEIGHT_REM = (GRID_END_HOUR - GRID_START_HOUR + 1) * 4;

function toInputDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clockLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function dayTitle(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", { weekday: "short", day: "2-digit", month: "short" });
}

function itemTopAndHeight(item: WeeklyLessonScheduleItem) {
  const start = new Date(item.startsAt);
  const end = new Date(item.endsAt);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const clampStart = Math.max(startMinutes, GRID_START_HOUR * 60);
  const clampEnd = Math.min(Math.max(endMinutes, clampStart + 20), GRID_END_HOUR * 60);
  const top = ((clampStart - GRID_START_HOUR * 60) / DAY_MINUTES) * 100;
  const height = Math.max(((clampEnd - clampStart) / DAY_MINUTES) * 100, 3.2);
  return { top, height };
}

function nowLineTopPercent(now: Date) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < GRID_START_HOUR * 60 || minutes > GRID_END_HOUR * 60) return null;
  return ((minutes - GRID_START_HOUR * 60) / DAY_MINUTES) * 100;
}

function SelectPremium({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-gray-500">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="ui-select min-h-11 w-full appearance-none rounded-xl border-white/10 bg-[#17171f] pr-10 text-sm font-semibold"
        >
          {children}
        </select>
        <ChevronDown
          size={16}
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#c4b5fd]"
        />
      </div>
    </label>
  );
}

export default function WeeklyLessonSchedulePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => getWeekStartMondayIso());
  const [lessonType, setLessonType] = useState<WeeklyLessonTypeFilter>("all");
  const [coachId, setCoachId] = useState("");
  const [location, setLocation] = useState("");
  const [snapshot, setSnapshot] = useState<WeeklyLessonScheduleSnapshot | null>(null);
  const [selected, setSelected] = useState<WeeklyLessonScheduleItem | null>(null);
  const [now, setNow] = useState(() => new Date());

  const fetchSnapshot = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await listWeeklyLessonScheduleSnapshot({
      weekStart,
      lessonType,
      coachId: coachId || undefined,
      location: location || undefined,
    });
    if ("error" in res) {
      setError(res.error);
      setSnapshot(null);
      setLoading(false);
      return;
    }
    setSnapshot(res);
    if (res.selectedCoachId && res.selectedCoachId !== coachId) {
      setCoachId(res.selectedCoachId);
    }
    setLoading(false);
  }, [weekStart, lessonType, coachId, location]);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchSnapshot();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchSnapshot]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const dayStarts = useMemo(() => getWeekDayStarts(weekStart), [weekStart]);
  const itemsByDay = useMemo(() => {
    const map = new Map<string, WeeklyLessonScheduleItem[]>();
    for (const dayIso of dayStarts) map.set(sameDayKey(dayIso), []);
    for (const item of snapshot?.items || []) {
      const key = sameDayKey(item.startsAt);
      if (!map.has(key)) continue;
      map.get(key)!.push(item);
    }
    for (const rows of map.values()) {
      rows.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    }
    return map;
  }, [dayStarts, snapshot?.items]);

  const hourRows = useMemo(
    () => Array.from({ length: GRID_END_HOUR - GRID_START_HOUR + 1 }, (_, i) => GRID_START_HOUR + i),
    []
  );

  function shiftWeek(days: number) {
    const start = new Date(weekStart);
    start.setDate(start.getDate() + days);
    setWeekStart(getWeekStartMondayIso(start.toISOString()));
  }

  const weekLabel = `${new Date(dayStarts[0]).toLocaleDateString("tr-TR")} - ${new Date(
    dayStarts[6]
  ).toLocaleDateString("tr-TR")}`;
  const todayKey = sameDayKey(now.toISOString());
  const nowTop = nowLineTopPercent(now);
  const weekContainsToday = dayStarts.some((d) => sameDayKey(d) === todayKey);
  const summary = useMemo(() => {
    const items = snapshot?.items || [];
    const totalLessons = items.length;
    const groupLessons = items.filter((i) => i.sourceType === "group").length;
    const privateLessons = items.filter((i) => i.sourceType === "private").length;
    const activeCoachCount = new Set(items.map((i) => i.coachId).filter(Boolean)).size;
    return { totalLessons, groupLessons, privateLessons, activeCoachCount };
  }, [snapshot?.items]);
  const hasFilterBeyondWeek = lessonType !== "all" || coachId.trim().length > 0 || location.trim().length > 0;
  const hasOnlyCoachFilter = coachId.trim().length > 0 && lessonType === "all" && location.trim().length === 0;
  const selectedCoachName = useMemo(
    () => snapshot?.coachOptions.find((c) => c.id === coachId)?.full_name || null,
    [snapshot?.coachOptions, coachId]
  );
  const emptyState = useMemo(() => {
    if ((snapshot?.items.length || 0) > 0) return null;
    if (hasOnlyCoachFilter) {
      return {
        title: `${selectedCoachName || "Seçili koç"} için bu haftada ders yok`,
        description: "Koç filtresini kaldırabilir, farklı bir hafta seçebilir veya yeni ders planlayabilirsiniz.",
      };
    }
    if (hasFilterBeyondWeek) {
      return {
        title: "Filtreye uygun ders bulunamadı",
        description: "Filtreleri genişleterek daha fazla kayıt görebilir veya yeni ders ekleyebilirsiniz.",
      };
    }
    return {
      title: "Bu hafta için ders planı bulunmuyor",
      description: "Çizelge hazır. İlk dersi oluşturduğunuzda haftalık plan burada görünecek.",
    };
  }, [snapshot?.items.length, hasOnlyCoachFilter, hasFilterBeyondWeek, selectedCoachName]);

  return (
    <div className="ui-page min-w-0 overflow-x-hidden pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
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
                onClick={() => shiftWeek(-7)}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 px-2.5 text-gray-300 sm:hover:bg-white/5"
                aria-label="Önceki hafta"
              >
                <ChevronLeft size={16} aria-hidden />
              </button>
              <input
                type="date"
                value={toInputDate(weekStart)}
                onChange={(e) => setWeekStart(getWeekStartMondayIso(e.target.value))}
                className="ui-input min-h-10"
              />
              <button
                type="button"
                onClick={() => shiftWeek(7)}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/10 px-2.5 text-gray-300 sm:hover:bg-white/5"
                aria-label="Sonraki hafta"
              >
                <ChevronRight size={16} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setWeekStart(getWeekStartMondayIso())}
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
              onChange={(next) => setLessonType(next as WeeklyLessonTypeFilter)}
            >
              <option value="all">Hepsi</option>
              <option value="group">Sadece grup dersleri</option>
              <option value="private">Sadece özel dersler</option>
            </SelectPremium>
          </div>

          <div className="lg:col-span-2">
            <SelectPremium label="Koç" value={coachId} onChange={setCoachId}>
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
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Saha, salon..."
              className="ui-input min-h-10 rounded-xl border-white/10 bg-[#17171f]"
            />
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

      {error ? <Notification message={error} variant="error" /> : null}

      {loading ? (
        <div className="flex min-h-[45dvh] items-center justify-center">
          <Loader2 className="animate-spin text-[#7c3aed]" size={40} aria-hidden />
        </div>
      ) : (
        <>
          <div className="mt-5 hidden overflow-x-auto rounded-2xl border border-white/10 bg-[#111114] md:block">
            <div className="min-w-[1120px]">
              <div className="grid grid-cols-[88px_repeat(7,minmax(140px,1fr))] border-b border-white/10">
                <div className="sticky left-0 z-30 bg-[#0f0f13] px-2 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Saat
                </div>
                {dayStarts.map((dayIso) => {
                  const isToday = sameDayKey(dayIso) === todayKey;
                  return (
                    <div
                      key={dayIso}
                      className={`border-l px-3 py-3 text-[11px] font-black uppercase tracking-wide ${
                        isToday
                          ? "border-[#7c3aed]/35 bg-[#7c3aed]/10 text-[#e4d9ff]"
                          : "border-white/10 text-white"
                      }`}
                    >
                      {dayTitle(dayIso)}
                      {isToday ? (
                        <span className="ml-2 rounded-md border border-[#7c3aed]/45 bg-[#7c3aed]/15 px-1.5 py-0.5 text-[9px]">
                          Bugün
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="relative grid grid-cols-[88px_repeat(7,minmax(140px,1fr))]">
                {weekContainsToday && nowTop != null ? (
                  <div
                    className="pointer-events-none absolute left-[88px] right-0 z-20 border-t border-rose-300/80"
                    style={{ top: `${nowTop}%` }}
                  >
                    <span className="absolute -left-12 -top-2 rounded bg-rose-500/90 px-1 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
                      Şu an
                    </span>
                  </div>
                ) : null}

                <div className="sticky left-0 z-20 relative border-r border-white/10 bg-[#0d0d11]">
                  {hourRows.map((h) => (
                    <div
                      key={h}
                      className={`h-16 border-b px-2 pt-1 text-[10px] font-black tabular-nums ${
                        h % 2 === 0 ? "border-white/10 bg-white/[0.02] text-gray-300" : "border-white/5 text-gray-400"
                      }`}
                    >
                      {String(h).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>

                {dayStarts.map((dayIso) => {
                  const dayKey = sameDayKey(dayIso);
                  const rows = itemsByDay.get(dayKey) || [];
                  return (
                    <div
                      key={dayIso}
                      className={`relative border-r last:border-r-0 ${
                        sameDayKey(dayIso) === todayKey
                          ? "border-[#7c3aed]/30 bg-[#7c3aed]/[0.04]"
                          : "border-white/10"
                      }`}
                      style={{ height: `${GRID_CONTAINER_HEIGHT_REM}rem` }}
                    >
                      {hourRows.map((h) => (
                        <div
                          key={h}
                          className={`h-16 border-b ${h % 2 === 0 ? "border-white/10 bg-white/[0.018]" : "border-white/5"}`}
                        />
                      ))}
                      {rows.map((item) => {
                        const { top, height } = itemTopAndHeight(item);
                        const isGroup = item.sourceType === "group";
                        return (
                          <button
                            key={`${item.sourceType}-${item.id}`}
                            type="button"
                            onClick={() => setSelected(item)}
                            className={`group absolute left-1.5 right-1.5 min-h-[60px] overflow-hidden rounded-2xl border px-3 py-2 text-left shadow-[0_10px_24px_-16px_rgba(0,0,0,0.95)] transition-all duration-150 sm:hover:-translate-y-0.5 ${
                              isGroup
                                ? "border-indigo-400/45 bg-indigo-500/15 text-indigo-50 sm:hover:shadow-[0_0_0_1px_rgba(129,140,248,0.5),0_16px_26px_-16px_rgba(99,102,241,0.85)]"
                                : "border-emerald-400/45 border-dashed bg-emerald-500/15 text-emerald-50 sm:hover:shadow-[0_0_0_1px_rgba(52,211,153,0.5),0_16px_26px_-16px_rgba(16,185,129,0.85)]"
                            }`}
                            style={{ top: `${top}%`, height: `${height}%` }}
                          >
                            <p className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider">
                              {isGroup ? <Users size={11} aria-hidden /> : <User size={11} aria-hidden />}
                              {isGroup ? "Grup Dersi" : "Özel Ders"}
                            </p>
                            <p className="mt-1 line-clamp-2 text-[11px] font-black leading-tight text-white">{item.title}</p>
                            <p className="mt-1 text-[10px] font-bold text-white/85">
                              {clockLabel(item.startsAt)} - {clockLabel(item.endsAt)}
                            </p>
                            <p className="mt-0.5 truncate text-[10px] font-bold text-white/75">{item.coachName || "Koç yok"}</p>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:hidden">
            {dayStarts.map((dayIso) => {
              const rows = itemsByDay.get(sameDayKey(dayIso)) || [];
              return (
                <section key={dayIso} className="rounded-2xl border border-white/10 bg-[#121215] p-4">
                  <h2 className="text-xs font-black uppercase tracking-wide text-white">{dayTitle(dayIso)}</h2>
                  {rows.length === 0 ? (
                    <p className="mt-2 text-[11px] font-bold text-gray-500">Ders yok.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {rows.map((item) => (
                        <button
                          key={`${item.sourceType}-${item.id}`}
                          type="button"
                          onClick={() => setSelected(item)}
                          className="w-full rounded-xl border border-white/10 bg-black/25 p-3 text-left"
                        >
                          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                            {item.sourceType === "group" ? "Grup Dersi" : "Özel Ders"} · {clockLabel(item.startsAt)}
                          </p>
                          <p className="mt-1 text-sm font-black text-white">{item.title}</p>
                          <p className="text-[11px] font-bold text-gray-400">{item.coachName || "Koç yok"}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}

      {selected ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center" onClick={() => setSelected(null)}>
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#17171d] p-6 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.95)]"
            onClick={(e) => e.stopPropagation()}
          >
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
              <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                {selected.status}
              </span>
            </div>
            <h3 className="mt-3 text-xl font-black uppercase tracking-tight text-white">{selected.title}</h3>
            <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              {selected.sourceType === "group" ? "Grup dersi oturumu" : "Özel ders oturumu"}
            </p>
            {selected.subtitle ? <p className="mt-2 text-sm font-bold text-gray-400">{selected.subtitle}</p> : null}

            <div className="mt-4 grid gap-2 rounded-xl border border-white/10 bg-black/20 p-4 text-[12px] font-bold text-gray-300">
              <p className="flex items-center gap-2">
                <Clock3 size={14} aria-hidden className="text-[#c4b5fd]" />
                {new Date(selected.startsAt).toLocaleString("tr-TR")} - {clockLabel(selected.endsAt)}
              </p>
              <p className="flex items-center gap-2">
                <User2 size={14} aria-hidden className="text-[#c4b5fd]" />
                Koç: {selected.coachName || "Atanmadı"}
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

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setSelected(null)} className="ui-btn-ghost min-h-11 px-4">
                Kapat
              </button>
              <Link href={selected.detailHref} className="ui-btn-primary min-h-11 px-5">
                İlgili detay sayfasına git
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && !error && emptyState ? (
        <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-gradient-to-b from-[#101014] to-[#13131a] p-10 text-center">
          <CalendarDays size={38} className="mx-auto text-gray-600" aria-hidden />
          <p className="mt-3 text-sm font-black uppercase tracking-[0.18em] text-gray-300">{emptyState.title}</p>
          <p className="mt-2 text-[12px] font-bold text-gray-500">{emptyState.description}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setLessonType("all");
                setCoachId("");
                setLocation("");
              }}
              className="ui-btn-ghost inline-flex min-h-11 items-center px-4"
            >
              Filtreleri temizle
            </button>
            <Link href="/dersler" className="ui-btn-primary inline-flex min-h-11 items-center px-4">
              Ders oluştur
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
