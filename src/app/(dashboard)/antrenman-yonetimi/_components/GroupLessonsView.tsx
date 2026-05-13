"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Search } from "lucide-react";
import EmptyStateCard from "@/components/EmptyStateCard";
import Notification from "@/components/Notification";
import { listLessonsSnapshot } from "@/lib/actions/snapshotActions";
import { cancelLesson, getLessonManagementDetail, hardDeleteLesson } from "@/lib/actions/lessonActions";
import { participantInitials } from "../_utils/training";

/**
 * Faz 6.1 — Grup dersleri çalışma alanı (liste + detay görünümü).
 *
 * Davranış: orijinal `GroupLessonsWorkspaceListDetail` ile birebir aynı.
 * Tek değişiklik: dosya konumu — büyük page.tsx'i parçalamak için.
 */
export function GroupLessonsView({
  lessonId,
  onOpenLesson,
  onBackToList,
}: {
  lessonId: string | null;
  onOpenLesson: (lessonId: string) => void;
  onBackToList: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "scheduled" | "completed" | "cancelled">("all");
  const [lessons, setLessons] = useState<Array<{
    id: string;
    title: string;
    location: string;
    startTime: string;
    endTime: string;
    capacity: number;
    status: string;
    coachName: string;
    participantCount: number;
    registeredCount: number;
    attendedCount: number;
    missedCount: number;
  }>>([]);
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getLessonManagementDetail>> | null>(null);
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    const res = await listLessonsSnapshot(1, 300);
    if ("error" in res) {
      setError(res.error || "Ders listesi alınamadı.");
      setLessons([]);
      setLoading(false);
      return;
    }
    const coachMap = new Map((res.coaches || []).map((c) => [c.id, c.full_name]));
    setLessons(
      (res.lessons || []).map((l) => ({
        id: l.id,
        title: l.title,
        location: l.location,
        startTime: l.startTime,
        endTime: l.endTime,
        capacity: l.capacity,
        status: l.status,
        coachName: l.coachId ? coachMap.get(l.coachId) || "Koç atanmadı" : "Koç atanmadı",
        participantCount: l.participantCount ?? 0,
        registeredCount: l.registeredCount ?? 0,
        attendedCount: l.attendedCount ?? 0,
        missedCount: l.missedCount ?? 0,
      }))
    );
    setError(null);
    setLoading(false);
  }, []);

  const loadDetail = useCallback(async () => {
    if (!lessonId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    const res = await getLessonManagementDetail(lessonId);
    if ("error" in res) {
      setError(res.error || "Ders detayı alınamadı.");
      setDetail(null);
      setLoading(false);
      return;
    }
    setDetail(res);
    setError(null);
    setLoading(false);
  }, [lessonId]);

  useEffect(() => {
    const id = setTimeout(() => {
      void loadList();
    }, 0);
    return () => clearTimeout(id);
  }, [loadList]);

  useEffect(() => {
    const id = setTimeout(() => {
      void loadDetail();
    }, 0);
    return () => clearTimeout(id);
  }, [loadDetail]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lessons
      .filter((l) => statusFilter === "all" || l.status === statusFilter)
      .filter((l) =>
        !q ||
        l.title.toLowerCase().includes(q) ||
        l.location.toLowerCase().includes(q) ||
        l.coachName.toLowerCase().includes(q)
      )
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [lessons, query, statusFilter]);

  const listStats = useMemo(() => {
    const planned = lessons.filter((l) => l.status === "scheduled").length;
    const cancelled = lessons.filter((l) => l.status === "cancelled").length;
    const pendingAttendance = lessons.filter((l) => l.status === "scheduled" && (l.registeredCount ?? 0) > 0).length;
    return { total: lessons.length, planned, cancelled, pendingAttendance };
  }, [lessons]);

  async function onCancelFromDetail() {
    if (!lessonId) return;
    const ok = window.confirm("Bu dersi iptal etmek istiyor musunuz?");
    if (!ok) return;
    setBusy(true);
    const res = await cancelLesson(lessonId);
    if ("error" in res) setError(res.error || "Ders iptal edilemedi.");
    else {
      await loadList();
      await loadDetail();
    }
    setBusy(false);
  }

  async function onHardDeleteFromDetail() {
    if (!lessonId || !detail || "error" in detail || detail.role !== "admin") return;
    const ok = window.confirm("Bu dersi kalıcı olarak silmek istiyor musunuz? Bu işlem geri alınamaz.");
    if (!ok) return;
    setBusy(true);
    const res = await hardDeleteLesson(lessonId);
    if ("error" in res) setError(res.error || "Ders kalıcı silinemedi.");
    else {
      await loadList();
      onBackToList();
    }
    setBusy(false);
  }

  if (loading && !detail && lessons.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#121215] px-6 py-14 text-center">
        <Loader2 className="mx-auto mb-3 size-8 animate-spin text-[#7c3aed]" aria-hidden />
        <p className="text-sm font-bold text-gray-400">Ders görünümü hazırlanıyor…</p>
      </div>
    );
  }

  if (detail && !("error" in detail)) {
    const lesson = detail.lesson;
    const statusLabel =
      lesson.status === "cancelled" ? "İptal Edildi" : lesson.status === "completed" ? "Tamamlandı" : "Planlandı";
    const statusClass =
      lesson.status === "cancelled"
        ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
        : lesson.status === "completed"
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
          : "border-amber-500/40 bg-amber-500/10 text-amber-200";
    const matchingListItem = lessons.find((item) => item.id === lesson.id);
    const coachName = matchingListItem?.coachName || "Koç atanmadı";
    const attendanceSummary = detail.participants.reduce(
      (acc, p) => {
        const st = p.attendance_status || "registered";
        if (st === "attended") acc.attended += 1;
        else if (st === "missed") acc.missed += 1;
        else if (st === "cancelled") acc.cancelled += 1;
        else acc.registered += 1;
        return acc;
      },
      { registered: 0, attended: 0, missed: 0, cancelled: 0 }
    );
    const attendanceStatusLabel =
      lesson.status === "cancelled"
        ? "Yoklama kapalı (ders iptal)"
        : attendanceSummary.attended > 0 || attendanceSummary.missed > 0
          ? "Yoklama başladı"
          : detail.participants.length > 0
            ? "Yoklama bekliyor"
            : "Katılımcı yok";
    const attendanceStatusClass =
      lesson.status === "cancelled"
        ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
        : attendanceSummary.attended > 0 || attendanceSummary.missed > 0
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          : detail.participants.length > 0
            ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
            : "border-white/15 bg-white/5 text-gray-300";
    const canCancel = lesson.status !== "cancelled";
    const canHardDelete = detail.role === "admin";
    const participantPreview = detail.participants.slice(0, 5);
    return (
      <section className="rounded-2xl border border-white/10 bg-[#121215] p-5 sm:p-6">
        <button
          type="button"
          onClick={onBackToList}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 text-[10px] font-black uppercase tracking-wide text-gray-300"
        >
          <ArrowLeft size={14} aria-hidden />
          Listeye dön
        </button>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-wide text-[#b8a4f8]">Grup Dersi Detayı</p>
              <p className="mt-1 text-lg font-black uppercase text-white">{lesson.title}</p>
              <p className="mt-1 text-[11px] font-semibold text-gray-300">
                {new Date(lesson.startTime).toLocaleDateString("tr-TR")} ·{" "}
                {new Date(lesson.startTime).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                {" - "}
                {new Date(lesson.endTime).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${statusClass}`}>
              {statusLabel}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wide text-gray-500">Koç</p>
              <p className="mt-1 text-[11px] font-semibold text-white">{coachName}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wide text-gray-500">Lokasyon</p>
              <p className="mt-1 text-[11px] font-semibold text-white">{lesson.location || "-"}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wide text-gray-500">Kapasite / Kayıtlı</p>
              <p className="mt-1 text-[11px] font-semibold text-white">{lesson.capacity} / {detail.participants.length}</p>
            </div>
            <div className={`rounded-lg border px-3 py-2 ${attendanceStatusClass}`}>
              <p className="text-[9px] font-black uppercase tracking-wide">Yoklama</p>
              <p className="mt-1 text-[11px] font-semibold">{attendanceStatusLabel}</p>
            </div>
          </div>

          <div className="mt-2 grid gap-1 text-[11px] font-semibold text-gray-400 sm:grid-cols-2">
            <p>Yoklama Özeti: <span className="text-gray-200">{attendanceSummary.attended} katıldı · {attendanceSummary.missed} gelmedi · {attendanceSummary.registered} bekliyor</span></p>
            <p>Ders Tipi: <span className="text-gray-200">Grup Dersi</span></p>
          </div>
          <p className="mt-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[11px] font-semibold text-gray-300">
            Açıklama: <span className="text-gray-100">{lesson.description?.trim() ? lesson.description : "Açıklama notu bulunmuyor."}</span>
          </p>
          <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-wide text-gray-300">Katılımcı Önizleme</p>
              <p className="text-[10px] font-semibold text-gray-400">
                Toplam {detail.participants.length} sporcu
              </p>
            </div>
            {participantPreview.length > 0 ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {participantPreview.map((participant) => {
                  const st = participant.attendance_status || "registered";
                  const stClass =
                    st === "attended"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                      : st === "missed"
                        ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                        : st === "cancelled"
                          ? "border-gray-500/30 bg-gray-500/10 text-gray-300"
                          : "border-amber-500/30 bg-amber-500/10 text-amber-100";
                  const stLabel =
                    st === "attended" ? "Katıldı" : st === "missed" ? "Gelmedi" : st === "cancelled" ? "İptal" : "Kayıtlı";
                  return (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 text-[9px] font-black text-gray-200">
                          {participantInitials(participant.full_name)}
                        </span>
                        <p className="truncate text-[11px] font-semibold text-gray-200">{participant.full_name}</p>
                      </div>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${stClass}`}>
                        {stLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-2 text-[11px] font-semibold text-gray-500">
                Bu derste henüz katılımcı bulunmuyor.
              </p>
            )}
            {detail.participants.length > participantPreview.length ? (
              <p className="mt-2 text-[10px] font-semibold text-gray-500">
                +{detail.participants.length - participantPreview.length} sporcu daha var.
              </p>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/dersler/${lesson.id}`}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-gray-200"
            >
              Düzenle
            </Link>
            <Link
              href={`/antrenman-yonetimi?modul=grup-dersleri&view=yoklama&trainingId=${lesson.id}`}
              className="rounded-lg border border-[#7c3aed]/35 bg-[#7c3aed]/20 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-[#ddd6fe]"
            >
              Yoklama Aç
            </Link>
            <button
              type="button"
              onClick={() => void onCancelFromDetail()}
              disabled={busy || !canCancel}
              className="rounded-lg border border-amber-500/35 bg-amber-500/20 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-amber-100 disabled:opacity-50"
            >
              Dersi İptal Et
            </button>
            {canHardDelete ? (
              <button
                type="button"
                onClick={() => void onHardDeleteFromDetail()}
                disabled={busy}
                className="rounded-lg border border-rose-500/35 bg-rose-500/20 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-rose-100 disabled:opacity-50"
              >
                Kalıcı Sil
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-[10px] font-semibold text-gray-500">
            İptal ve kalıcı silme işlemleri geri alınamaz etkiler doğurabilir; işlem öncesi kontrol önerilir.
          </p>
        </div>
        {error ? (
          <div className="mt-4">
            <Notification message={error} variant="error" />
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-[#121215] p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-black uppercase text-white">Ders Listesi</h2>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <div className="relative w-full sm:w-72">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ders, koç veya lokasyon ara"
              className="ui-input min-h-10 pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | "scheduled" | "completed" | "cancelled")
            }
            className="ui-select min-h-10 sm:w-44"
          >
            <option value="all">Tüm durumlar</option>
            <option value="scheduled">Planlandı</option>
            <option value="completed">Tamamlandı</option>
            <option value="cancelled">İptal Edildi</option>
          </select>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-wide text-gray-500">Toplam Ders</p>
          <p className="mt-1 text-lg font-black text-white">{listStats.total}</p>
        </div>
        <div className="rounded-lg border border-[#7c3aed]/25 bg-[#7c3aed]/10 px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-wide text-[#d8cbff]">Planlanan</p>
          <p className="mt-1 text-lg font-black text-white">{listStats.planned}</p>
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-wide text-amber-200">Yoklama Bekleyen</p>
          <p className="mt-1 text-lg font-black text-white">{listStats.pendingAttendance}</p>
        </div>
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-wide text-rose-200">İptal</p>
          <p className="mt-1 text-lg font-black text-white">{listStats.cancelled}</p>
        </div>
      </div>
      {error ? (
        <div className="mt-3">
          <Notification message={error} variant="error" />
        </div>
      ) : null}
      <div className="mt-4 grid gap-3">
        {filtered.length === 0 ? (
          <EmptyStateCard
            title="Kayıt bulunamadı"
            description="Seçili filtreye uygun ders kaydı bulunamadı."
            reason="Durum filtresi veya arama metni sonucu daraltmış olabilir."
            primaryAction={{
              label: "Filtreleri sıfırla",
              onClick: () => {
                setQuery("");
                setStatusFilter("all");
              },
            }}
            secondaryAction={{ label: "Takvime git", href: "/haftalik-ders-programi" }}
          />
        ) : (
          filtered.map((lesson) => (
            <div
              key={lesson.id}
              className="rounded-xl border border-white/10 bg-black/20 p-4 transition hover:border-[#7c3aed]/35 hover:bg-[#7c3aed]/10"
            >
              <button type="button" onClick={() => onOpenLesson(lesson.id)} className="w-full text-left">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-black uppercase text-white">{lesson.title}</p>
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${
                      lesson.status === "cancelled"
                        ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
                        : lesson.status === "completed"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                          : "border-amber-500/40 bg-amber-500/10 text-amber-200"
                    }`}
                  >
                    {lesson.status === "cancelled"
                      ? "İptal Edildi"
                      : lesson.status === "completed"
                        ? "Tamamlandı"
                        : "Planlandı"}
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-semibold text-gray-300">
                  {new Date(lesson.startTime).toLocaleDateString("tr-TR")} ·{" "}
                  {new Date(lesson.startTime).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                  -
                  {new Date(lesson.endTime).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                </p>
                <div className="mt-2 grid gap-1 text-[11px] font-semibold text-gray-400 sm:grid-cols-2">
                  <p>
                    Koç: <span className="text-gray-200">{lesson.coachName}</span>
                  </p>
                  <p>
                    Lokasyon: <span className="text-gray-200">{lesson.location}</span>
                  </p>
                  <p>
                    Kapasite/Kayıtlı:{" "}
                    <span className="text-gray-200">
                      {lesson.capacity}/{lesson.participantCount}
                    </span>
                  </p>
                  <p>
                    Yoklama:{" "}
                    <span className="text-gray-200">
                      {lesson.status === "completed"
                        ? "Tamamlandı"
                        : lesson.status === "cancelled"
                          ? "İptal"
                          : (lesson.registeredCount ?? 0) > 0
                            ? `Bekliyor (${lesson.registeredCount})`
                            : "Hazır"}
                    </span>
                  </p>
                </div>
              </button>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onOpenLesson(lesson.id)}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-gray-200"
                >
                  Aç
                </button>
                <Link
                  href={`/antrenman-yonetimi?modul=grup-dersleri&view=yoklama&trainingId=${lesson.id}`}
                  className="rounded-lg border border-[#7c3aed]/35 bg-[#7c3aed]/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#ddd6fe]"
                >
                  Yoklama Aç
                </Link>
                <Link
                  href={`/dersler/${lesson.id}`}
                  className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-gray-200"
                >
                  Düzenle
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default GroupLessonsView;
