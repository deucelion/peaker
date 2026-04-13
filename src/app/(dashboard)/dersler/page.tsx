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
      setError(snapshot.error ?? "Veri dizini alinamadi.");
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
      setMessage("Tarih ve saat alanlari zorunludur.");
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
      setMessage("Ders olusturuldu.");
      setForm((prev) => ({ ...prev, title: "", description: "", location: "Ana Saha", lessonDate: "", startClock: "", endClock: "" }));
      setSelectedAthletes([]);
      await fetchData();
    } else {
      setMessage(result?.error || "Ders olusturulamadi.");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[50dvh] min-w-0 flex-col items-center justify-center gap-4 overflow-x-hidden px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        <Loader2 className="animate-spin text-[#7c3aed]" size={44} aria-hidden />
        <p className="text-center text-[10px] font-black uppercase italic tracking-widest text-gray-500">Dersler yukleniyor...</p>
      </div>
    );
  }

  return (
    <div className="ui-page min-w-0 overflow-x-hidden pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-b border-white/5 pb-6 min-w-0">
        <div className="min-w-0">
          <h1 className="ui-h1">
            DERS <span className="text-[#7c3aed]">MERKEZI</span>
          </h1>
          <p className="ui-lead break-words">
            Koç ve katılımcı yönetimi
          </p>
        </div>
        <div className="relative w-full min-w-0 shrink-0 md:w-72">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={16} aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="DERS ARA..."
            type="search"
            className="min-h-11 w-full min-w-0 touch-manipulation rounded-2xl border border-white/5 bg-[#121215] py-3 pl-10 pr-4 text-base font-black uppercase italic text-white outline-none focus:border-[#7c3aed]/50 sm:text-xs"
          />
        </div>
      </header>

      {(error || message) ? (
        <div className="min-w-0 break-words">
          <Notification message={error || message || ""} variant={error ? "error" : message?.toLowerCase().includes("olusturuldu") ? "success" : "info"} />
        </div>
      ) : null}
      {!error && role === "admin" && coaches.length === 0 && (
        <Notification message="Koç listesi boş. Önce bir koç oluşturun." variant="info" />
      )}

      {!error && (
        <form
          onSubmit={handleCreateLesson}
          className="ui-card space-y-4 min-w-0 [&_input]:text-base [&_input]:sm:text-xs [&_select]:text-base [&_select]:sm:text-xs [&_input]:touch-manipulation [&_select]:touch-manipulation"
        >
            <h3 className="ui-h2-sm flex min-w-0 items-center gap-2">
            <Plus size={16} className="shrink-0 text-[#7c3aed]" aria-hidden /> Yeni Ders
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 ui-grid-tight">
            <div className="ui-field">
              <label className="ui-label">Ders Basligi</label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="DERS BASLIGI"
                className="ui-input italic"
              />
            </div>
            <div className="ui-field">
              <label className="ui-label">Aciklama</label>
              <input
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="ACIKLAMA"
                className="ui-input italic"
              />
            </div>
            <div className="ui-field">
              <label className="ui-label">Lokasyon</label>
              <input
                required
                value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                placeholder="ANA SAHA"
                className="ui-input italic"
              />
            </div>
            <div className="ui-field">
              <label className="ui-label">Ders Tarihi</label>
              <input
                required
                type="date"
                value={form.lessonDate}
                onChange={(e) => setForm((p) => ({ ...p, lessonDate: e.target.value }))}
                className="ui-input italic"
              />
            </div>
            <div className="ui-field">
              <label className="ui-label">Kapasite</label>
              <input
                required
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))}
                placeholder="KAPASITE"
                className="ui-input italic"
              />
            </div>
            <div className="ui-field">
              <label className="ui-label">Baslangic Saati</label>
              <input
                required
                type="time"
                value={form.startClock}
                onChange={(e) => setForm((p) => ({ ...p, startClock: e.target.value }))}
                className="ui-input italic"
              />
            </div>
            <div className="ui-field">
              <label className="ui-label">Bitis Saati</label>
              <input
                required
                type="time"
                value={form.endClock}
                onChange={(e) => setForm((p) => ({ ...p, endClock: e.target.value }))}
                className="ui-input italic"
              />
            </div>
            {role === "admin" ? (
              <div className="ui-field">
                <label className="ui-label">Koç Seçimi</label>
                <select
                  value={form.coachId}
                  onChange={(e) => setForm((p) => ({ ...p, coachId: e.target.value }))}
                  className="ui-select italic"
                >
                  {coaches.length === 0 && <option value="">KOC BULUNAMADI</option>}
                  {coaches.map((coach) => (
                    <option key={coach.id} value={coach.id}>{coach.full_name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="ui-field">
                <label className="ui-label">Koç</label>
                <input value="KOC: BEN" readOnly className="ui-input italic text-gray-400" />
              </div>
            )}
          </div>
          {form.coachId && form.lessonDate && (
            <div className="bg-[#1c1c21] border border-white/10 rounded-xl p-3">
              <p className="ui-label mb-2">Koç Uygunluk Önizleme</p>
              {coachDayLessons.length === 0 ? (
                <p className="text-[10px] font-bold text-gray-500 italic">Bu tarihte secili koc icin kayitli ders yok.</p>
              ) : (
                <div className="grid gap-2">
                  {coachDayLessons.map((lesson) => (
                    <div key={lesson.id} className="text-[10px] font-bold text-gray-300 bg-black/30 border border-white/10 rounded-lg px-3 py-2 break-words min-w-0">
                      {lesson.title} - {new Date(lesson.start_time).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                      {" - "}
                      {new Date(lesson.end_time).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

            <div className="bg-[#1c1c21] border border-white/10 rounded-xl p-3">
            <p className="ui-label mb-2">Sporcu Seçimi</p>
            <div className="max-h-40 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
              {athletes.map((athlete) => {
                const checked = selectedAthletes.includes(athlete.id);
                return (
                  <label key={athlete.id} className="flex items-start gap-3 text-[11px] text-gray-300 font-bold min-h-10 py-1 touch-manipulation cursor-pointer min-w-0">
                    <input
                      type="checkbox"
                      checked={checked}
                      className="mt-1 size-4 shrink-0 accent-[#7c3aed]"
                      onChange={(e) =>
                        setSelectedAthletes((prev) =>
                          e.target.checked ? [...prev, athlete.id] : prev.filter((id) => id !== athlete.id)
                        )
                      }
                    />
                    <span className="break-words min-w-0">{athlete.full_name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving || (role === "admin" && coaches.length === 0) || (role === "coach" && !permissions.can_create_lessons)}
            className="ui-btn-primary px-6 w-full sm:w-auto min-h-12 touch-manipulation"
          >
            {saving ? "OLUSTURULUYOR..." : "DERS OLUSTUR"}
          </button>
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
                  <p className="text-[10px] text-gray-500 font-bold italic break-words">{lesson.description || "Acilklama yok"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] font-black uppercase min-w-0">
                  <span className="ui-badge-neutral max-w-full break-words">
                    <Calendar size={12} className="shrink-0 inline" /> {new Date(lesson.startTime).toLocaleString("tr-TR")}
                  </span>
                  <span className="ui-badge-neutral break-words max-w-full">
                    {lesson.location}
                  </span>
                  <span className="ui-badge-neutral text-[#c4b5fd] border-[#7c3aed]/20 bg-[#7c3aed]/10 shrink-0">
                    {lesson.capacity} KISI
                  </span>
                  <span className={`shrink-0 ${lesson.status === "cancelled" ? "ui-badge-danger" : "ui-badge-success"}`}>
                    {lesson.status.toUpperCase()}
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
