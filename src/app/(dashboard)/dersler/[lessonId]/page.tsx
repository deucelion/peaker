"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2, UserMinus, UserPlus, XCircle } from "lucide-react";
import Notification from "@/components/Notification";
import {
  addLessonParticipants,
  cancelLesson,
  getLessonManagementDetail,
  removeLessonParticipant,
  updateLesson,
} from "@/lib/actions/lessonActions";
import { combineLocalDateAndTime, splitIsoToDateAndTime } from "@/lib/forms/datetimeLocal";
import type { Lesson } from "@/lib/types";
import { DEFAULT_COACH_PERMISSIONS } from "@/lib/types";
import { profileRowIsActive } from "@/lib/coach/lifecycle";

interface AthleteProfile {
  id: string;
  full_name: string;
  is_active?: boolean | null;
}

export default function LessonDetailPage() {
  const params = useParams();
  const lessonId = typeof params.lessonId === "string" ? params.lessonId : params.lessonId?.[0] || "";

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"admin" | "coach" | "sporcu">("sporcu");
  const [actorId, setActorId] = useState<string>("");
  const [permissions, setPermissions] = useState(DEFAULT_COACH_PERMISSIONS);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [participants, setParticipants] = useState<AthleteProfile[]>([]);
  const [allAthletes, setAllAthletes] = useState<AthleteProfile[]>([]);
  const [selectedAddIds, setSelectedAddIds] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    location: "",
    lessonDate: "",
    startClock: "",
    endClock: "",
    capacity: "20",
  });

  const fetchData = useCallback(async () => {
    if (!lessonId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getLessonManagementDetail(lessonId);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setActorId(res.actorId);
      setRole(res.role);
      setPermissions(res.permissions);
      setLesson(res.lesson);
      setParticipants(res.participants);
      setAllAthletes(res.allAthletes);
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchData]);

  useEffect(() => {
    if (!lesson) return;
    const start = splitIsoToDateAndTime(lesson.startTime);
    const end = splitIsoToDateAndTime(lesson.endTime);
    setEditForm({
      title: lesson.title,
      description: lesson.description,
      location: lesson.location,
      lessonDate: start.date,
      startClock: start.time,
      endClock: end.time,
      capacity: String(lesson.capacity),
    });
  }, [lesson]);

  const canEditLessonDetails =
    lesson &&
    lesson.status !== "cancelled" &&
    (role === "admin" || (role === "coach" && permissions.can_edit_lessons && lesson.coachId === actorId));

  const availableAthletes = useMemo(() => {
    const set = new Set(participants.map((p) => p.id));
    return allAthletes.filter((a) => !set.has(a.id) && profileRowIsActive(a.is_active));
  }, [allAthletes, participants]);

  async function handleAddParticipants() {
    if (!lesson) return;
    const result = await addLessonParticipants(lesson.id, selectedAddIds);
    if (result?.success) {
      setMessage("Sporcular derse eklendi.");
      setSelectedAddIds([]);
      await fetchData();
    } else {
      setMessage(result?.error || "Sporcular eklenemedi.");
    }
  }

  async function handleRemoveParticipant(profileId: string) {
    if (!lesson) return;
    const result = await removeLessonParticipant(lesson.id, profileId);
    if (result?.success) {
      setMessage("Sporcu dersten cikarildi.");
      await fetchData();
    } else {
      setMessage(result?.error || "Sporcu cikarilamadi.");
    }
  }

  async function handleCancelLesson() {
    if (!lesson) return;
    if (!window.confirm("Bu dersi iptal etmek istediginize emin misiniz? Kayit silinmez; durum iptal olur ve katilimcilara bildirim gider.")) {
      return;
    }
    const result = await cancelLesson(lesson.id);
    if (result?.success) {
      setMessage("Ders iptal edildi.");
      await fetchData();
    } else {
      setMessage(result?.error || "Ders iptal edilemedi.");
    }
  }

  async function handleSaveLessonEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!lesson || !canEditLessonDetails) return;
    if (!editForm.lessonDate || !editForm.startClock || !editForm.endClock) {
      setMessage("Duzenleme icin tarih ve saat zorunludur.");
      return;
    }
    setEditSaving(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("lessonId", lesson.id);
    fd.append("title", editForm.title);
    fd.append("description", editForm.description);
    fd.append("location", editForm.location);
    fd.append("startTime", combineLocalDateAndTime(editForm.lessonDate, editForm.startClock));
    fd.append("endTime", combineLocalDateAndTime(editForm.lessonDate, editForm.endClock));
    fd.append("capacity", editForm.capacity);
    const result = await updateLesson(fd);
    if (result?.success) {
      setMessage("Ders bilgileri guncellendi.");
      await fetchData();
    } else {
      setMessage(result?.error || "Ders guncellenemedi.");
    }
    setEditSaving(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[50dvh] min-w-0 flex-col items-center justify-center gap-4 overflow-x-hidden px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        <Loader2 className="animate-spin text-[#7c3aed]" size={44} aria-hidden />
        <p className="text-center text-[10px] font-black uppercase italic tracking-wide text-gray-500 sm:tracking-widest">Ders detayi yukleniyor...</p>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="min-w-0 space-y-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
        <Link href="/dersler" className="inline-flex min-h-11 items-center text-[10px] font-black uppercase tracking-wide text-[#7c3aed] touch-manipulation sm:tracking-widest">
          Dersler
        </Link>
        <div className="min-w-0 break-words">
          <Notification message={error || "Ders bulunamadı."} variant="error" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 pb-[max(4rem,env(safe-area-inset-bottom,0px))] min-w-0 overflow-x-hidden">
      <Link href="/dersler" className="inline-flex min-h-11 items-center text-[#7c3aed] text-[10px] font-black uppercase tracking-wide sm:tracking-widest touch-manipulation">
        Dersler
      </Link>

      {message ? (
        <div className="min-w-0 break-words">
          <Notification message={message} variant={message.toLowerCase().includes("edilemedi") || message.toLowerCase().includes("hata") ? "error" : "success"} />
        </div>
      ) : null}

      <section className="bg-[#121215] border border-white/5 rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 min-w-0">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between min-w-0">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-black italic uppercase text-white break-words">{lesson.title}</h1>
            <p className="text-[10px] text-gray-500 font-bold italic mt-2 break-words">{lesson.description || "Aciklama yok"}</p>
            <p className="text-[10px] text-gray-500 font-bold italic mt-2 break-words">
              {new Date(lesson.startTime).toLocaleString("tr-TR")} - {new Date(lesson.endTime).toLocaleString("tr-TR")}
            </p>
            <p className="text-[10px] text-gray-500 font-bold italic mt-1 break-words">
              Lokasyon: {lesson.location}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 shrink-0 w-full lg:w-auto">
            <span className="px-3 py-2 sm:py-1 rounded-xl bg-[#7c3aed]/10 border border-[#7c3aed]/20 text-[#c4b5fd] text-[10px] font-black uppercase text-center sm:text-left">
              KAPASITE {lesson.capacity}
            </span>
            <Link
              href={`/antrenman-yonetimi?trainingId=${lesson.id}`}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#7c3aed] px-4 py-2 text-[10px] font-black uppercase text-white touch-manipulation sm:hover:bg-[#6d28d9]"
            >
              Yoklamaya Git
            </Link>
            <button
              type="button"
              onClick={handleCancelLesson}
              disabled={lesson.status === "cancelled" || (role === "coach" && (lesson.coachId !== actorId || !permissions.can_edit_lessons))}
              className="min-h-11 inline-flex items-center justify-center px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase disabled:opacity-40 touch-manipulation"
            >
              <span className="inline-flex items-center gap-1"><XCircle size={12} aria-hidden /> Dersi iptal et</span>
            </button>
          </div>
        </div>
      </section>

      {canEditLessonDetails ? (
        <section className="bg-[#121215] border border-white/5 rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 space-y-4 min-w-0">
          <h3 className="text-sm font-black italic uppercase text-white">Dersi duzenle</h3>
          <p className="text-[10px] text-gray-500 font-bold break-words">
            Iptal edilmemis derslerde baslik, aciklama, lokasyon, tarih/saat ve kapasite guncellenir. Kayit silinmez; kapasite mevcut katilimcinin altina dusurulemez.
          </p>
          <form
            onSubmit={handleSaveLessonEdit}
            className="grid min-w-0 gap-3 md:grid-cols-2 [&_input]:min-h-11 [&_input]:touch-manipulation [&_input]:text-base [&_input]:font-black [&_input]:italic [&_input]:sm:text-xs"
          >
            <div className="space-y-1 md:col-span-2 min-w-0">
              <label className="text-[9px] text-gray-500 font-black uppercase">Baslik</label>
              <input
                required
                value={editForm.title}
                onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                className="w-full min-w-0 bg-[#1c1c21] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#7c3aed]/60"
              />
            </div>
            <div className="space-y-1 md:col-span-2 min-w-0">
              <label className="text-[9px] text-gray-500 font-black uppercase">Aciklama</label>
              <input
                value={editForm.description}
                onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                className="w-full min-w-0 bg-[#1c1c21] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#7c3aed]/60"
              />
            </div>
            <div className="space-y-1 min-w-0">
              <label className="text-[9px] text-gray-500 font-black uppercase">Lokasyon</label>
              <input
                required
                value={editForm.location}
                onChange={(e) => setEditForm((p) => ({ ...p, location: e.target.value }))}
                className="w-full min-w-0 bg-[#1c1c21] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#7c3aed]/60"
              />
            </div>
            <div className="space-y-1 min-w-0">
              <label className="text-[9px] text-gray-500 font-black uppercase">Kapasite</label>
              <input
                required
                type="number"
                min={participants.length || 1}
                value={editForm.capacity}
                onChange={(e) => setEditForm((p) => ({ ...p, capacity: e.target.value }))}
                className="w-full min-w-0 bg-[#1c1c21] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#7c3aed]/60"
              />
            </div>
            <div className="space-y-1 min-w-0">
              <label className="text-[9px] text-gray-500 font-black uppercase">Tarih</label>
              <input
                required
                type="date"
                value={editForm.lessonDate}
                onChange={(e) => setEditForm((p) => ({ ...p, lessonDate: e.target.value }))}
                className="w-full min-w-0 bg-[#1c1c21] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#7c3aed]/60"
              />
            </div>
            <div className="space-y-1 min-w-0">
              <label className="text-[9px] text-gray-500 font-black uppercase">Baslangic</label>
              <input
                required
                type="time"
                value={editForm.startClock}
                onChange={(e) => setEditForm((p) => ({ ...p, startClock: e.target.value }))}
                className="w-full min-w-0 bg-[#1c1c21] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#7c3aed]/60"
              />
            </div>
            <div className="space-y-1 min-w-0">
              <label className="text-[9px] text-gray-500 font-black uppercase">Bitis</label>
              <input
                required
                type="time"
                value={editForm.endClock}
                onChange={(e) => setEditForm((p) => ({ ...p, endClock: e.target.value }))}
                className="w-full min-w-0 bg-[#1c1c21] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-[#7c3aed]/60"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={editSaving}
                className="min-h-11 w-full touch-manipulation rounded-xl bg-[#7c3aed] px-5 py-3 text-[10px] font-black uppercase text-white disabled:opacity-50 sm:w-auto sm:hover:bg-[#6d28d9]"
              >
                {editSaving ? "Kaydediliyor..." : "Degisiklikleri kaydet"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="bg-[#121215] border border-white/5 rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 space-y-4 min-w-0">
        <h3 className="text-sm font-black italic uppercase text-white">Katilimcilar ({participants.length}/{lesson.capacity})</h3>
        {participants.length === 0 ? (
          <p className="text-gray-500 text-[10px] font-black uppercase italic">Bu derse henuz sporcu eklenmedi.</p>
        ) : (
          <div className="grid gap-2 min-w-0">
            {participants.map((p) => (
              <div key={p.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white/[0.02] border border-white/5 rounded-xl p-3 min-w-0">
                <span className="text-white text-sm font-black italic uppercase break-words min-w-0 flex-1">{p.full_name}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveParticipant(p.id)}
                  disabled={role === "coach" && (lesson.coachId !== actorId || !permissions.can_add_athletes_to_lessons)}
                  className="min-h-11 shrink-0 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black uppercase disabled:opacity-40 inline-flex items-center justify-center gap-1 touch-manipulation w-full sm:w-auto"
                >
                  <UserMinus size={12} aria-hidden /> Dersten cikar
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-[#121215] border border-white/5 rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 space-y-4 min-w-0">
        <h3 className="text-sm font-black italic uppercase text-white">Sporcu Ekle</h3>
        {availableAthletes.length === 0 ? (
          <p className="text-gray-500 text-[10px] font-black uppercase italic">Tüm sporcular derste veya sporcu yok.</p>
        ) : (
          <>
            <div className="max-h-48 sm:max-h-40 overflow-y-auto overflow-x-hidden grid md:grid-cols-2 gap-2 min-w-0 [-webkit-overflow-scrolling:touch]">
              {availableAthletes.map((a) => (
                <label key={a.id} className="flex items-start gap-3 text-[11px] text-gray-300 font-bold min-w-0 touch-manipulation py-1">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 touch-manipulation"
                    checked={selectedAddIds.includes(a.id)}
                    onChange={(e) =>
                      setSelectedAddIds((prev) => (e.target.checked ? [...prev, a.id] : prev.filter((id) => id !== a.id)))
                    }
                  />
                  <span className="break-words min-w-0">{a.full_name}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={handleAddParticipants}
              disabled={selectedAddIds.length === 0 || (role === "coach" && (lesson.coachId !== actorId || !permissions.can_add_athletes_to_lessons))}
              className="inline-flex min-h-11 w-full touch-manipulation items-center justify-center gap-1 rounded-xl bg-[#7c3aed] px-4 py-2 text-[10px] font-black uppercase text-white disabled:opacity-40 sm:w-auto sm:hover:bg-[#6d28d9]"
            >
              <UserPlus size={12} aria-hidden /> Seçilenleri Ekle
            </button>
          </>
        )}
      </section>
    </div>
  );
}
