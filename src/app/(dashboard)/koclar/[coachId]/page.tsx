"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Calendar, ChevronLeft, Clock, Loader2, MapPin, User } from "lucide-react";
import Notification from "@/components/Notification";
import { mapCoach, mapCoachLesson } from "@/lib/mappers";
import type { CoachLesson, CoachProfile } from "@/lib/types";
import type { CoachPermissionKey, CoachPermissions } from "@/lib/types";
import { DEFAULT_COACH_PERMISSIONS } from "@/lib/types";
import { loadCoachAdminDetailBundle, resolveOrganizationIdForCoachAdminDetail } from "@/lib/actions/coachActions";
import { updateCoachProfileByAdmin } from "@/lib/actions/coachProfileActions";
import { updateCoachPermissions } from "@/lib/actions/coachPermissionActions";
import CoachAccountLifecyclePanel from "../CoachAccountLifecyclePanel";

function CoachProfilePageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orgFromQuery = searchParams.get("org")?.trim() || "";
  const coachId = typeof params.coachId === "string" ? params.coachId : params.coachId?.[0] || "";
  const [listOrgId, setListOrgId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coach, setCoach] = useState<CoachProfile | null>(null);
  const [lessons, setLessons] = useState<CoachLesson[]>([]);
  const [permissions, setPermissions] = useState<CoachPermissions>(DEFAULT_COACH_PERMISSIONS);
  const [permissionMessage, setPermissionMessage] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({ fullName: "", phone: "", specialization: "" });

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const orgRes = await resolveOrganizationIdForCoachAdminDetail(orgFromQuery || null);
        if ("error" in orgRes) {
          setError(orgRes.error ?? "Profil alinamadi.");
          return;
        }
        const orgId = orgRes.organizationId;
        setListOrgId(orgId);

        const bundle = await loadCoachAdminDetailBundle(coachId, orgId);
        if ("error" in bundle) {
          setError(bundle.error ?? "Koç profili alınamadı.");
          return;
        }
        const mapped = mapCoach(bundle.row);
        setCoach(mapped);
        setProfileForm({
          fullName: mapped.fullName,
          phone: mapped.phone === "-" ? "" : mapped.phone,
          specialization: mapped.expertise === "Genel" ? "" : mapped.expertise,
        });

        const rawSchedules = bundle.scheduleRows.filter((s) => Boolean(s?.id));
        const mappedLessons = rawSchedules.map((row) => mapCoachLesson(row));
        setLessons(mappedLessons.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));

        setPermissions(bundle.permissions);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Bilinmeyen hata";
        setError(`Koç detayı yüklenemedi: ${message}`);
      } finally {
        setLoading(false);
      }
    }
    if (coachId) void fetchData();
  }, [coachId, orgFromQuery]);

  const pastLessons = useMemo(() => lessons.filter((l) => l.status === "past"), [lessons]);
  const upcomingLessons = useMemo(() => lessons.filter((l) => l.status === "upcoming"), [lessons]);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    if (!coach) return;
    setProfileSaving(true);
    setProfileMessage(null);
    const result = await updateCoachProfileByAdmin(coach.id, {
      fullName: profileForm.fullName,
      phone: profileForm.phone,
      specialization: profileForm.specialization,
    });
    if (result?.success) {
      setCoach((prev) =>
        prev
          ? {
              ...prev,
              fullName: profileForm.fullName.trim(),
              phone: profileForm.phone.trim() || "-",
              expertise: profileForm.specialization.trim() || "Genel",
            }
          : prev
      );
      setProfileMessage("Koç bilgileri güncellendi.");
    } else {
      setProfileMessage(result?.error || "Profil guncellenemedi.");
    }
    setProfileSaving(false);
  }

  async function togglePermission(key: CoachPermissionKey, value: boolean) {
    if (!coach) return;
    setPermissionMessage(null);
    const result = await updateCoachPermissions(coach.id, { [key]: value });
    if (result?.success) {
      setPermissions((prev) => ({ ...prev, [key]: value }));
      setPermissionMessage("Yetkiler guncellendi.");
    } else {
      setPermissionMessage(result?.error || "Yetki guncellenemedi.");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50dvh] min-w-0 flex-col items-center justify-center gap-4 overflow-x-hidden px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        <Loader2 className="animate-spin text-[#7c3aed]" size={44} aria-hidden />
        <p className="text-center text-[10px] font-black uppercase italic tracking-widest text-gray-500">Koç Profili Yükleniyor...</p>
      </div>
    );
  }

  if (error || !coach) {
    return (
      <div className="min-w-0 space-y-4 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
        <Link
          href={listOrgId ? `/koclar?org=${encodeURIComponent(listOrgId)}` : "/koclar"}
          className="inline-flex min-h-11 items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#7c3aed] touch-manipulation"
        >
          <ChevronLeft size={14} className="shrink-0" aria-hidden /> Koçlar
        </Link>
        <div className="min-w-0 break-words">
          <Notification message={error || "Koç profili bulunamadı."} variant="error" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-[max(4rem,env(safe-area-inset-bottom,0px))] min-w-0 overflow-x-hidden">
      <Link
        href={listOrgId ? `/koclar?org=${encodeURIComponent(listOrgId)}` : "/koclar"}
        className="inline-flex min-h-11 items-center gap-2 text-[#7c3aed] text-[10px] font-black uppercase tracking-widest touch-manipulation"
      >
        <ChevronLeft size={14} className="shrink-0" aria-hidden /> <span className="break-words">Koçlar Listesi</span>
      </Link>

      <section className="bg-[#121215] border border-white/5 rounded-[1.75rem] sm:rounded-[2rem] p-5 sm:p-6 shadow-xl min-w-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0">
          <div className="flex items-start gap-4 min-w-0">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#1c1c21] text-[#7c3aed]">
              <User size={24} aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-black italic uppercase text-white tracking-tighter break-words">{coach.fullName}</h1>
              <p className="text-[10px] text-gray-500 font-bold italic break-all">{coach.email}</p>
              <p className="text-[9px] text-gray-600 font-bold mt-1 break-words">E-posta giris adresi buradan degismez; sadece goruntuleme.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase min-w-0">
            <span className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-gray-300 break-all max-w-full">{coach.phone}</span>
            <span className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-gray-300 break-words max-w-full">{coach.expertise}</span>
            <span className={`px-3 py-1 rounded-xl border ${coach.isActive ? "text-green-400 border-green-500/20 bg-green-500/10" : "text-red-400 border-red-500/20 bg-red-500/10"}`}>
              {coach.isActive ? "AKTIF" : "PASIF"}
            </span>
            <span className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-gray-400">
              {coach.createdAt ? new Date(coach.createdAt).toLocaleDateString("tr-TR") : "-"}
            </span>
          </div>
        </div>
      </section>

      <section className="bg-[#121215] border border-white/5 rounded-[1.75rem] sm:rounded-[2rem] p-5 sm:p-6 space-y-4 min-w-0">
        <h3 className="text-base sm:text-lg font-black italic text-white uppercase break-words">Koç bilgilerini düzenle</h3>
        {profileMessage ? (
          <div className="min-w-0 break-words">
            <Notification message={profileMessage} variant={profileMessage.toLowerCase().includes("hata") || profileMessage.toLowerCase().includes("edilemedi") ? "error" : "success"} />
          </div>
        ) : null}
        <form onSubmit={handleProfileSave} className="grid md:grid-cols-2 gap-3 min-w-0 [&_input]:min-h-11 [&_input]:text-base [&_input]:md:text-xs [&_input]:touch-manipulation">
          <div className="space-y-1 md:col-span-2 min-w-0">
            <label className="text-[9px] text-gray-500 font-black uppercase">Ad soyad</label>
            <input
              required
              value={profileForm.fullName}
              onChange={(e) => setProfileForm((p) => ({ ...p, fullName: e.target.value }))}
              className="w-full min-w-0 bg-[#1c1c21] border border-white/10 rounded-xl px-4 py-3 font-black italic text-white outline-none focus:border-[#7c3aed]/60"
            />
          </div>
          <div className="space-y-1 min-w-0">
            <label className="text-[9px] text-gray-500 font-black uppercase">Telefon</label>
            <input
              value={profileForm.phone}
              onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))}
              inputMode="tel"
              className="w-full min-w-0 bg-[#1c1c21] border border-white/10 rounded-xl px-4 py-3 font-black italic text-white outline-none focus:border-[#7c3aed]/60"
            />
          </div>
          <div className="space-y-1 min-w-0">
            <label className="text-[9px] text-gray-500 font-black uppercase">Uzmanlik</label>
            <input
              value={profileForm.specialization}
              onChange={(e) => setProfileForm((p) => ({ ...p, specialization: e.target.value }))}
              placeholder="Orn. Atletik performans"
              className="w-full min-w-0 bg-[#1c1c21] border border-white/10 rounded-xl px-4 py-3 font-black italic text-white outline-none focus:border-[#7c3aed]/60"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={profileSaving}
              className="min-h-11 w-full touch-manipulation rounded-xl bg-[#7c3aed] px-5 py-3 text-[10px] font-black uppercase text-white disabled:opacity-50 sm:w-auto sm:hover:bg-[#6d28d9]"
            >
              {profileSaving ? "Kaydediliyor..." : "Profili kaydet"}
            </button>
          </div>
        </form>
      </section>

      <CoachAccountLifecyclePanel coachId={coach.id} coachName={coach.fullName} isActive={coach.isActive} />

      <section className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard label="Toplam Ders" value={lessons.length} />
        <SummaryCard label="Geçmiş Ders" value={pastLessons.length} />
        <SummaryCard label="Yaklaşan Ders" value={upcomingLessons.length} />
      </section>

      <section className="bg-[#121215] border border-white/5 rounded-[1.75rem] sm:rounded-[2rem] p-5 sm:p-6 space-y-4 min-w-0">
        <h3 className="text-base sm:text-lg font-black italic text-white uppercase">Yetkiler</h3>
        {permissionMessage ? (
          <div className="min-w-0 break-words">
            <Notification message={permissionMessage} variant={permissionMessage.toLowerCase().includes("hata") ? "error" : "success"} />
          </div>
        ) : null}
        <div className="grid md:grid-cols-2 gap-3">
          {[
            { key: "can_create_lessons", label: "Ders Oluşturma" },
            { key: "can_edit_lessons", label: "Ders Duzenleme" },
            { key: "can_view_all_athletes", label: "Tüm Sporcuları Görme" },
            { key: "can_add_athletes_to_lessons", label: "Derse Sporcu Ekleme" },
            { key: "can_take_attendance", label: "Yoklama Alma" },
            { key: "can_view_reports", label: "Raporlari Gorme" },
            { key: "can_manage_training_notes", label: "Not/Program Yönetimi" },
          ].map((item) => {
            const checked = permissions[item.key as CoachPermissionKey];
            return (
              <label key={item.key} className="flex items-center justify-between gap-3 bg-white/[0.02] border border-white/5 rounded-xl p-3 min-h-12 touch-manipulation cursor-pointer min-w-0">
                <span className="text-[11px] font-black uppercase text-gray-300 break-words pr-2">{item.label}</span>
                <input
                  type="checkbox"
                  checked={checked}
                  className="size-4 shrink-0 accent-[#7c3aed]"
                  onChange={(e) => void togglePermission(item.key as CoachPermissionKey, e.target.checked)}
                />
              </label>
            );
          })}
        </div>
      </section>

      <section className="bg-[#121215] border border-white/5 rounded-[1.75rem] sm:rounded-[2rem] p-5 sm:p-6 space-y-4 min-w-0">
        <h3 className="text-base sm:text-lg font-black italic text-white uppercase">Katildigi Dersler</h3>
        {pastLessons.length === 0 ? (
          <EmptyState text="Geçmiş ders kaydı bulunmuyor." />
        ) : (
          <div className="grid gap-3">
            {pastLessons.map((lesson) => (
              <LessonRow key={lesson.id} lesson={lesson} />
            ))}
          </div>
        )}
      </section>

      <section className="bg-[#121215] border border-white/5 rounded-[1.75rem] sm:rounded-[2rem] p-5 sm:p-6 space-y-4 min-w-0">
        <h3 className="text-base sm:text-lg font-black italic text-white uppercase">Katilacagi Dersler</h3>
        {upcomingLessons.length === 0 ? (
          <EmptyState text="Yaklaşan ders kaydı bulunmuyor." />
        ) : (
          <div className="grid gap-3">
            {upcomingLessons.map((lesson) => (
              <LessonRow key={lesson.id} lesson={lesson} />
            ))}
          </div>
        )}
      </section>

      <section className="bg-[#121215] border border-white/5 rounded-[1.75rem] sm:rounded-[2rem] p-5 sm:p-6 min-w-0">
        <Link
          href="/antrenman-yonetimi"
          className="inline-flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-[#7c3aed] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white sm:w-auto sm:hover:bg-[#6d28d9]"
        >
          Antrenman Planina Git
        </Link>
      </section>
    </div>
  );
}

export default function CoachProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50dvh] min-w-0 flex-col items-center justify-center gap-4 overflow-x-hidden px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
          <Loader2 className="animate-spin text-[#7c3aed]" size={44} aria-hidden />
          <p className="text-center text-[10px] font-black uppercase italic tracking-widest text-gray-500">Koç Profili Yükleniyor...</p>
        </div>
      }
    >
      <CoachProfilePageInner />
    </Suspense>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-[1.5rem] border border-white/5 bg-[#121215] p-5">
      <p className="text-[9px] font-black uppercase tracking-widest text-gray-600 italic">{label}</p>
      <p className="text-3xl font-black italic text-white mt-2">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-10 text-center border border-dashed border-white/10 rounded-2xl">
      <p className="text-gray-500 font-black italic uppercase text-[10px] tracking-widest">{text}</p>
    </div>
  );
}

function LessonRow({ lesson }: { lesson: CoachLesson }) {
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0">
      <div className="min-w-0 flex-1">
        <p className="text-white font-black italic uppercase text-sm break-words">{lesson.title}</p>
        <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-gray-500 font-bold uppercase italic">
          <span className="inline-flex min-w-0 items-center gap-1"><Calendar size={12} className="shrink-0" aria-hidden /> {new Date(lesson.startTime).toLocaleDateString("tr-TR")}</span>
          <span className="inline-flex items-center gap-1"><Clock size={12} className="shrink-0" aria-hidden /> {new Date(lesson.startTime).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
          <span className="inline-flex min-w-0 items-start gap-1"><MapPin size={12} className="mt-0.5 shrink-0" aria-hidden /> <span className="break-words">{lesson.location}</span></span>
        </div>
      </div>
      <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase ${lesson.status === "past" ? "bg-white/5 text-gray-400" : "bg-[#7c3aed]/10 text-[#c4b5fd]"}`}>
        {lesson.status === "past" ? "GECMIS" : "YAKLASAN"}
      </span>
    </div>
  );
}
