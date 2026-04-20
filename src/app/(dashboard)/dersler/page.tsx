"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, Loader2, Plus, Search, Users } from "lucide-react";
import Notification from "@/components/Notification";
import { createLesson } from "@/lib/actions/lessonActions";
import { listCoachDayLessonsSnapshot, listLessonsSnapshot } from "@/lib/actions/snapshotActions";
import type { Lesson } from "@/lib/types";
import { DEFAULT_COACH_PERMISSIONS } from "@/lib/types";
import { profileRowIsActive } from "@/lib/coach/lifecycle";
import { formatLessonDateTimeTr, formatLessonTimeTr } from "@/lib/forms/datetimeLocal";
import { lessonStatusBadgeClass, lessonStatusLabelTr } from "@/lib/lesson/lessonStatusUi";

interface CoachOption {
  id: string;
  full_name: string;
}

interface AthleteOption {
  id: string;
  full_name: string;
  is_active?: boolean | null;
}

interface CoachLessonPreview {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
}

export default function LessonsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"admin" | "coach" | "sporcu">("sporcu");
  const [permissions, setPermissions] = useState(DEFAULT_COACH_PERMISSIONS);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [coachDayLessons, setCoachDayLessons] = useState<CoachLessonPreview[]>([]);
  const [selectedAthletes, setSelectedAthletes] = useState<string[]>([]);
  const [athleteSearch, setAthleteSearch] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "Ana Saha",
    lessonDate: "",
    startClock: "",
    endClock: "",
    capacity: "20",
    coachId: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const snapshot = await listLessonsSnapshot(1, 200);
    if ("error" in snapshot) {
      setError(snapshot.error ?? "Veri alınamadı.");
      setLoading(false);
      return;
    }

    const resolvedRole = snapshot.role;
    const resolvedPermissions = snapshot.permissions ?? DEFAULT_COACH_PERMISSIONS;
    setRole(resolvedRole);
    setPermissions(resolvedPermissions);
    setLessons(snapshot.lessons as Lesson[]);
    setCoaches((snapshot.coaches || []) as CoachOption[]);
    const athleteRows = (snapshot.athletes || []) as AthleteOption[];
    setAthletes(
      athleteRows.filter((a) => profileRowIsActive(a.is_active)).map(({ id, full_name }) => ({ id, full_name }))
    );

    if (resolvedRole === "coach") {
      setForm((prev) => ({ ...prev, coachId: snapshot.actorUserId }));
    } else if ((snapshot.coaches || []).length > 0) {
      setForm((prev) => ({ ...prev, coachId: prev.coachId || snapshot.coaches[0].id }));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchData]);

  const filteredLessons = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lessons;
    return lessons.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.status.toLowerCase().includes(q)
    );
  }, [lessons, search]);

  const filteredAthletes = useMemo(() => {
    const q = athleteSearch.trim().toLowerCase();
    if (!q) return athletes;
    return athletes.filter((athlete) => athlete.full_name.toLowerCase().includes(q));
  }, [athletes, athleteSearch]);

  const coachNameById = useMemo(() => {
    return new Map(coaches.map((coach) => [coach.id, coach.full_name]));
  }, [coaches]);

  const athleteNameById = useMemo(() => new Map(athletes.map((a) => [a.id, a.full_name])), [athletes]);

  useEffect(() => {
    const id = setTimeout(() => {
      void (async () => {
        if (!form.coachId || !form.lessonDate) {
          setCoachDayLessons([]);
          return;
        }
        const preview = await listCoachDayLessonsSnapshot(form.coachId, form.lessonDate);
        if ("error" in preview) {
          setCoachDayLessons([]);
          return;
        }
        setCoachDayLessons((preview.lessons || []) as CoachLessonPreview[]);
      })();
    }, 0);
    return () => clearTimeout(id);
  }, [form.coachId, form.lessonDate]);

  async function handleCreateLesson(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    if (!form.lessonDate || !form.startClock || !form.endClock) {
      setMessage("Lütfen tarih ile başlangıç ve bitiş saatini seçin.");
      setSaving(false);
      return;
    }

    const startTime = `${form.lessonDate}T${form.startClock}`;
    const endTime = `${form.lessonDate}T${form.endClock}`;

    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("description", form.description);
    fd.append("location", form.location);
    fd.append("startTime", startTime);
    fd.append("endTime", endTime);
    fd.append("capacity", form.capacity);
    fd.append("coachId", form.coachId);
    selectedAthletes.forEach((id) => fd.append("athleteIds", id));

    const result = await createLesson(fd);
    if (result?.success) {
      setMessage("Ders oluşturuldu.");
      setForm((prev) => ({ ...prev, title: "", description: "", location: "Ana Saha", lessonDate: "", startClock: "", endClock: "" }));
      setSelectedAthletes([]);
      await fetchData();
    } else {
      setMessage(result?.error || "Ders oluşturulamadı.");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[50dvh] min-w-0 flex-col items-center justify-center gap-4 overflow-x-hidden px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        <Loader2 className="animate-spin text-[#7c3aed]" size={44} aria-hidden />
        <p className="text-center text-[10px] font-black uppercase italic tracking-widest text-gray-500">Dersler yükleniyor…</p>
      </div>
    );
  }

  return (
    <div className="ui-page min-w-0 overflow-x-hidden pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex min-w-0 flex-col gap-4 border-b border-white/5 pb-6 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">İşlem ekranı</p>
          <h1 className="ui-h1">
            Ders <span className="text-[#7c3aed]">merkezi</span>
          </h1>
          <p className="ui-lead max-w-xl break-words normal-case tracking-normal">
            Yeni ders oluşturun; aşağıdaki listeden mevcut derslere geçin.
          </p>
        </div>
        <div className="relative w-full min-w-0 shrink-0 md:w-80">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-gray-600" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ders ara…"
            type="search"
            className="min-h-11 w-full min-w-0 touch-manipulation rounded-2xl border border-white/5 bg-[#121215] py-3 pl-11 pr-4 text-sm font-medium text-white outline-none placeholder:text-gray-600 focus:border-[#7c3aed]/50"
          />
        </div>
      </header>

      {(error || message) ? (
        <div className="min-w-0 break-words">
          <Notification
            message={error || message || ""}
            variant={
              error ? "error" : message && /oluşturuldu|olusturuldu/i.test(message) ? "success" : "info"
            }
          />
        </div>
      ) : null}
      {!error && role === "admin" && coaches.length === 0 && (
        <Notification message="Koç listesi boş. Önce bir koç oluşturun." variant="info" />
      )}

      {!error && (
        <form
          onSubmit={handleCreateLesson}
          className="ui-card min-w-0 space-y-6 [&_input]:touch-manipulation [&_select]:touch-manipulation [&_input]:text-sm [&_select]:text-sm"
        >
          <div className="flex min-w-0 flex-col gap-2 border-b border-white/5 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <Plus size={18} className="shrink-0 text-[#7c3aed]" aria-hidden />
              <div>
                <h2 className="text-lg font-black tracking-tight text-white sm:text-xl">Yeni ders oluştur</h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  1 Başlık → 2 Zaman ve yer → 3 Koç ve kapasite → 4 Katılımcılar → Kaydet
                </p>
              </div>
            </div>
          </div>

          <section className="space-y-3 rounded-2xl border border-white/8 bg-black/25 p-4 sm:p-5">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c4b5fd]">1 · Ders bilgisi</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 ui-grid-tight">
              <div className="ui-field md:col-span-2">
                <label className="ui-label">Ders başlığı</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Örn. Teknik ve pas çalışması"
                  className="ui-input font-semibold"
                />
              </div>
              <div className="ui-field md:col-span-2">
                <label className="ui-label">
                  Açıklama <span className="font-normal normal-case text-gray-600">(isteğe bağlı)</span>
                </label>
                <input
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Kısa not veya odak alanı"
                  className="ui-input"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-white/8 bg-black/25 p-4 sm:p-5">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c4b5fd]">2 · Zaman ve yer</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 ui-grid-tight">
              <div className="ui-field sm:col-span-2 lg:col-span-1">
                <label className="ui-label">Tarih</label>
                <input
                  required
                  type="date"
                  value={form.lessonDate}
                  onChange={(e) => setForm((p) => ({ ...p, lessonDate: e.target.value }))}
                  className="ui-input"
                />
              </div>
              <div className="ui-field">
                <label className="ui-label">Başlangıç</label>
                <input
                  required
                  type="time"
                  value={form.startClock}
                  onChange={(e) => setForm((p) => ({ ...p, startClock: e.target.value }))}
                  className="ui-input"
                />
              </div>
              <div className="ui-field">
                <label className="ui-label">Bitiş</label>
                <input
                  required
                  type="time"
                  value={form.endClock}
                  onChange={(e) => setForm((p) => ({ ...p, endClock: e.target.value }))}
                  className="ui-input"
                />
              </div>
              <div className="ui-field sm:col-span-2 lg:col-span-2">
                <label className="ui-label">Lokasyon</label>
                <input
                  required
                  value={form.location}
                  onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                  placeholder="Ana saha, salon…"
                  className="ui-input"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-white/8 bg-black/25 p-4 sm:p-5">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c4b5fd]">3 · Koç ve kapasite</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 ui-grid-tight">
              {role === "admin" ? (
                <div className="ui-field">
                  <label className="ui-label">Koç</label>
                  <select
                    value={form.coachId}
                    onChange={(e) => setForm((p) => ({ ...p, coachId: e.target.value }))}
                    className="ui-select"
                  >
                    {coaches.length === 0 && <option value="">Koç bulunamadı</option>}
                    {coaches.map((coach) => (
                      <option key={coach.id} value={coach.id}>
                        {coach.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="ui-field">
                  <label className="ui-label">Koç</label>
                  <input value="Siz (oturum açan koç)" readOnly className="ui-input text-gray-400" />
                </div>
              )}
              <div className="ui-field">
                <label className="ui-label">Kapasite (kişi)</label>
                <input
                  required
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))}
                  placeholder="20"
                  className="ui-input tabular-nums"
                />
              </div>
            </div>
          </section>

          {form.coachId && form.lessonDate ? (
            <div className="rounded-xl border border-white/10 bg-[#1c1c21] p-4">
              <p className="ui-label mb-2">Bu koçun aynı günkü dersleri</p>
              {coachDayLessons.length === 0 ? (
                <p className="text-xs text-gray-500">Bu tarihte bu koça atanmış başka ders kaydı yok.</p>
              ) : (
                <ul className="grid max-h-36 gap-2 overflow-y-auto">
                  {coachDayLessons.map((lesson) => (
                    <li
                      key={lesson.id}
                      className="min-w-0 break-words rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs font-medium text-gray-300"
                    >
                      <span className="font-semibold text-white">{lesson.title}</span>
                      <span className="text-gray-500">
                        {" "}
                        · {formatLessonTimeTr(lesson.start_time)} – {formatLessonTimeTr(lesson.end_time)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <section className="space-y-3 rounded-2xl border border-white/8 bg-black/25 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c4b5fd]">4 · Katılımcılar</h3>
                <p className="mt-1 text-xs text-gray-500">Listeyi arayın; işaretledikleriniz derse eklenir.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold tabular-nums text-gray-300">
                  Seçili: {selectedAthletes.length}
                </span>
                {selectedAthletes.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setSelectedAthletes([])}
                    className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold text-gray-400 touch-manipulation hover:border-red-500/30 hover:text-red-300"
                  >
                    Seçimi temizle
                  </button>
                ) : null}
              </div>
            </div>
            {selectedAthletes.length > 0 ? (
              <p className="text-xs leading-relaxed text-gray-400">
                <span className="font-semibold text-gray-300">Seçilenler: </span>
                {selectedAthletes
                  .map((id) => athleteNameById.get(id))
                  .filter(Boolean)
                  .slice(0, 12)
                  .join(", ")}
                {selectedAthletes.length > 12 ? ` ve +${selectedAthletes.length - 12} kişi` : ""}
              </p>
            ) : null}
            <input
              type="search"
              value={athleteSearch}
              onChange={(e) => setAthleteSearch(e.target.value)}
              placeholder="Sporcu adıyla ara…"
              className="ui-input min-h-11"
            />
            <div className="grid max-h-52 min-h-[8rem] grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
              {filteredAthletes.map((athlete) => {
                const checked = selectedAthletes.includes(athlete.id);
                return (
                  <label
                    key={athlete.id}
                    className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-lg border px-2 py-2 text-sm font-medium touch-manipulation min-w-0 ${
                      checked ? "border-[#7c3aed]/40 bg-[#7c3aed]/10 text-white" : "border-transparent hover:bg-white/[0.04]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      className="size-4 shrink-0 accent-[#7c3aed]"
                      onChange={(e) =>
                        setSelectedAthletes((prev) =>
                          e.target.checked ? [...prev, athlete.id] : prev.filter((id) => id !== athlete.id)
                        )
                      }
                    />
                    <span className="min-w-0 break-words">{athlete.full_name}</span>
                  </label>
                );
              })}
              {filteredAthletes.length === 0 ? (
                <p className="col-span-full py-4 text-center text-xs text-gray-500">Aramaya uygun sporcu bulunamadı.</p>
              ) : null}
            </div>
          </section>

          <div className="sticky bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] z-20 -mx-1 flex flex-col gap-2 border-t border-white/10 bg-[#0c0c0f]/95 px-1 pt-4 backdrop-blur-sm sm:static sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:border-t-0 sm:bg-transparent sm:pt-0 sm:backdrop-blur-none">
            <p className="hidden text-xs text-gray-500 sm:block">Kaydetmeden önce tarih, saat ve koç alanlarını kontrol edin.</p>
            <button
              type="submit"
              disabled={saving || (role === "admin" && coaches.length === 0) || (role === "coach" && !permissions.can_create_lessons)}
              className="ui-btn-primary min-h-12 w-full touch-manipulation px-8 font-black sm:ml-auto sm:w-auto sm:min-w-[12rem]"
            >
              {saving ? "Oluşturuluyor…" : "Dersi oluştur"}
            </button>
          </div>
        </form>
      )}

      {!error && filteredLessons.length === 0 && (
        <div className="ui-card p-8 text-center sm:p-16">
          <Users size={40} className="mx-auto mb-4 text-gray-700" aria-hidden />
          <p className="text-gray-500 font-black italic uppercase tracking-widest text-xs">Ders kaydı bulunamadı.</p>
        </div>
      )}

      {!error && filteredLessons.length > 0 && (
        <div className="ui-grid-tight">
          {filteredLessons.map((lesson) => (
            <Link
              key={lesson.id}
              href={`/dersler/${lesson.id}`}
              className="block min-h-[4.5rem] min-w-0 touch-manipulation rounded-[1.75rem] border border-white/5 bg-[#121215] p-4 transition-all sm:hover:border-[#7c3aed]/30"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0">
                <div className="min-w-0 flex-1">
                  <p className="text-white text-base sm:text-lg font-black italic uppercase break-words">{lesson.title}</p>
                  <p className="text-[10px] text-gray-500 font-bold italic break-words">{lesson.description || "Açıklama yok"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] font-black uppercase min-w-0">
                  <span className="ui-badge-neutral max-w-full break-words">
                    <Calendar size={12} className="shrink-0 inline" /> {formatLessonDateTimeTr(lesson.startTime)}
                  </span>
                  <span className="ui-badge-neutral break-words max-w-full">
                    {lesson.location}
                  </span>
                  <span className="ui-badge-neutral break-words max-w-full">
                    Koç: {lesson.coachId ? (coachNameById.get(lesson.coachId) ?? "Bilinmiyor") : "Atanmadı"}
                  </span>
                  <span className="ui-badge-neutral text-[#c4b5fd] border-[#7c3aed]/20 bg-[#7c3aed]/10 shrink-0">
                    {lesson.capacity} kişi
                  </span>
                  <span
                    className={`shrink-0 text-[11px] font-bold !normal-case ${lessonStatusBadgeClass(lesson.status)}`}
                  >
                    {lessonStatusLabelTr(lesson.status)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
