"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  Clock,
  Users,
  Check,
  X,
  MapPin,
  Activity,
  Loader2,
  ChevronDown,
  CalendarDays,
} from "lucide-react";
import { listAttendanceSnapshot, listTrainingParticipantsSnapshot } from "@/lib/actions/snapshotActions";
import type { TrainingParticipantRow, TrainingScheduleRow } from "@/types/domain";
import Notification from "@/components/Notification";
import { setAttendanceStatus } from "@/lib/actions/attendanceActions";
import { DEFAULT_COACH_PERMISSIONS } from "@/lib/types";

function toAttendanceBadgeLabel(
  status: "registered" | "attended" | "missed" | "cancelled" | null | undefined
) {
  if (status === "attended") return "KATILDI";
  if (status === "missed") return "GELMEDİ";
  if (status === "cancelled") return "İPTAL";
  return "KAYITLI";
}

function notificationVariantFromMessage(message: string): "success" | "error" {
  const m = message.toLowerCase();
  if (
    m.includes("başarı") ||
    m.includes("basari") ||
    m.includes("güncellendi") ||
    m.includes("guncellendi") ||
    m.includes("başarılı") ||
    m.includes("basarili")
  ) {
    return "success";
  }
  return "error";
}

function formatTrainingDateTr(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("tr-TR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}

function formatTrainingTimeShort(iso: string | null | undefined) {
  if (!iso) return "--:--";
  try {
    return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
}

/** Filtrelerden bağımsız; liste ile aynı normalizasyon. */
function normalizedAttendanceStatus(p: TrainingParticipantRow): "registered" | "attended" | "missed" | "cancelled" {
  return (p.attendance_status ||
    (p.is_present === true ? "attended" : p.is_present === false ? "missed" : "registered")) as
    | "registered"
    | "attended"
    | "missed"
    | "cancelled";
}

export default function AntrenmanYonetimi() {
  const searchParams = useSearchParams();
  const requestedTrainingId = searchParams.get("trainingId");
  const [trainings, setTrainings] = useState<TrainingScheduleRow[]>([]);
  const [selectedTrainingId, setSelectedTrainingId] = useState<string>("");
  const [participants, setParticipants] = useState<TrainingParticipantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actorRole, setActorRole] = useState<"admin" | "coach" | "sporcu">("sporcu");
  const [permissions, setPermissions] = useState(DEFAULT_COACH_PERMISSIONS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "registered" | "attended" | "missed" | "cancelled">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [rowSavingIds, setRowSavingIds] = useState<string[]>([]);
  const [lessonMenuOpen, setLessonMenuOpen] = useState(false);
  const lessonMenuRef = useRef<HTMLDivElement>(null);

  const selectedTraining = trainings.find((t) => t.id === selectedTrainingId);

  useEffect(() => {
    if (!lessonMenuOpen) return;
    function onDoc(e: MouseEvent) {
      if (lessonMenuRef.current && !lessonMenuRef.current.contains(e.target as Node)) {
        setLessonMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [lessonMenuOpen]);

  const loadParticipants = useCallback(async (tId: string) => {
    const snapshot = await listTrainingParticipantsSnapshot(tId, 1, 300);
    if ("error" in snapshot) {
      setActionMessage(snapshot.error || "Katılımcı verisi alınamadı.");
      setParticipants([]);
      return;
    }
    const data = (snapshot.participants || []) as unknown as TrainingParticipantRow[];
    if (data) {
      const normalized = data.map((row) => ({
        ...row,
        attendance_status:
          row.attendance_status ||
          (row.is_present === true ? "attended" : row.is_present === false ? "missed" : "registered"),
      }));
      setParticipants(normalized);
    } else setParticipants([]);
  }, []);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    const snapshot = await listAttendanceSnapshot(1, 200);
    if ("error" in snapshot) {
      setActionMessage(snapshot.error || "Veri alınamadı.");
      setLoading(false);
      return;
    }
    const resolvedRole: "admin" | "coach" | "sporcu" = snapshot.role;
    const resolvedPermissions = snapshot.permissions ?? DEFAULT_COACH_PERMISSIONS;
    setActorRole(resolvedRole);
    setPermissions(resolvedPermissions);

    const tData = (snapshot.trainings || []) as unknown as TrainingScheduleRow[];
    if (tData && tData.length > 0) {
      setTrainings(tData);
      const trainingList = tData;
      const preferredTrainingId =
        requestedTrainingId && trainingList.some((training) => training.id === requestedTrainingId)
          ? requestedTrainingId
          : trainingList[0].id;
      setSelectedTrainingId(preferredTrainingId);
      void loadParticipants(preferredTrainingId);
    } else {
      setTrainings([]);
      setSelectedTrainingId("");
      setParticipants([]);
    }
    setLoading(false);
  }, [requestedTrainingId, loadParticipants]);

  useEffect(() => {
    const id = setTimeout(() => {
      void loadInitialData();
    }, 0);
    return () => clearTimeout(id);
  }, [loadInitialData]);

  // YOKLAMA DURUMUNU GÜNCELLEME
  async function updateAttendance(profileId: string, status: "registered" | "attended" | "missed" | "cancelled") {
    if (!selectedTrainingId) return;
    setRowSavingIds((prev) => [...prev, profileId]);
    const result = await setAttendanceStatus(selectedTrainingId, profileId, status);
    if (result?.success) {
      setParticipants((prev) => prev.map((p) => 
        p.profile_id === profileId
          ? {
              ...p,
              attendance_status: status,
              is_present: status === "attended" ? true : status === "missed" ? false : null,
            }
          : p
      ));
    } else {
      setActionMessage(result?.error || "Yoklama güncellenemedi.");
    }
    setRowSavingIds((prev) => prev.filter((id) => id !== profileId));
  }

  const rosterAttendanceSummary = useMemo(() => {
    const counts = { total: participants.length, registered: 0, attended: 0, missed: 0, cancelled: 0 };
    for (const p of participants) {
      const s = normalizedAttendanceStatus(p);
      if (s === "attended") counts.attended += 1;
      else if (s === "missed") counts.missed += 1;
      else if (s === "cancelled") counts.cancelled += 1;
      else counts.registered += 1;
    }
    return counts;
  }, [participants]);

  const filteredParticipants = participants.filter((p) => {
    const normalized = normalizedAttendanceStatus(p);
    const matchesStatus = statusFilter === "all" || normalized === statusFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (p.profiles.full_name || "").toLowerCase().includes(q) ||
      (p.profiles.position || "").toLowerCase().includes(q) ||
      (p.profiles.team || "").toLowerCase().includes(q) ||
      (p.profiles.number != null ? String(p.profiles.number) : "").toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  async function applyBulkStatus(status: "registered" | "attended" | "missed" | "cancelled", onlySelected: boolean) {
    if (!selectedTrainingId) return;
    const targetIds = onlySelected
      ? selectedIds
      : filteredParticipants.map((p) => p.profile_id);
    if (targetIds.length === 0) {
      setActionMessage("Önce kutucuklardan sporcu seçin.");
      return;
    }
    setBulkSaving(true);
    const results = await Promise.all(
      targetIds.map(async (profileId) => {
        const res = await setAttendanceStatus(selectedTrainingId, profileId, status);
        return { profileId, ok: Boolean(res?.success), error: res?.error || null };
      })
    );
    const failed = results.filter((r) => !r.ok);
    const succeededIds = new Set(results.filter((r) => r.ok).map((r) => r.profileId));
    setParticipants((prev) =>
      prev.map((p) =>
        succeededIds.has(p.profile_id)
          ? {
              ...p,
              attendance_status: status,
              is_present: status === "attended" ? true : status === "missed" ? false : null,
            }
          : p
      )
    );
    setSelectedIds([]);
    if (failed.length > 0) {
      const failedSet = new Set(failed.map((f) => f.profileId));
      const failedNames = filteredParticipants
        .filter((p) => failedSet.has(p.profile_id))
        .map((p) => p.profiles.full_name || "Sporcu")
        .slice(0, 3);
      const suffix = failed.length > 3 ? ` +${failed.length - 3}` : "";
      setActionMessage(`${failed.length} kayıt güncellenemedi (${failedNames.join(", ")}${suffix}); diğerleri başarılı.`);
    } else {
      setActionMessage("Toplu yoklama başarıyla güncellendi.");
    }
    setBulkSaving(false);
  }

  if (loading)
    return (
      <div className="flex min-h-[45dvh] min-w-0 flex-col items-center justify-center gap-4 overflow-x-hidden px-4 py-10 pb-[max(1rem,env(safe-area-inset-bottom,0px))] text-center text-sm font-black uppercase italic tracking-wide text-white animate-pulse sm:tracking-widest">
        <Loader2 className="h-10 w-10 animate-spin text-[#7c3aed]" aria-hidden />
        <span>Operasyon Merkezi Hazırlanıyor...</span>
      </div>
    );

  return (
    <div className="space-y-6 sm:space-y-8 pb-[max(4rem,env(safe-area-inset-bottom,0px))] min-w-0 overflow-x-hidden">
      <header className="min-w-0 space-y-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">İşlem ekranı</p>
          <h1 className="text-2xl font-black uppercase italic tracking-tighter text-white break-words sm:text-3xl">
            Antrenman <span className="text-[#7c3aed]">&</span> yoklama
          </h1>
          <p className="mt-2 border-l-2 border-[#7c3aed] pl-3 text-sm font-medium text-gray-500 sm:pl-4 sm:text-base">
            Dersi seçin, listeyi daraltın, sporcu satırından veya toplu işlemle yoklamayı güncelleyin.
          </p>
        </div>
        <nav
          className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-gray-500"
          aria-label="Yoklama adımları"
        >
          <span className="rounded-full border border-[#7c3aed]/40 bg-[#7c3aed]/10 px-2.5 py-1 text-[#c4b5fd] tabular-nums">1 · Ders</span>
          <span className="text-gray-700" aria-hidden>
            →
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-gray-400">2 · Kadro</span>
          <span className="text-gray-700" aria-hidden>
            →
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-gray-400">3 · Yoklama</span>
          <span className="text-gray-700" aria-hidden>
            →
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-gray-400">4 · Kontrol</span>
        </nav>
      </header>
      {actionMessage ? (
        <div className="min-w-0 break-words">
          <Notification message={actionMessage} variant={notificationVariantFromMessage(actionMessage)} />
        </div>
      ) : null}

      {trainings.length === 0 ? (
        <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-[#121215] px-6 py-16 text-center sm:rounded-[2rem]">
          <Activity className="mx-auto mb-4 size-10 text-gray-700" aria-hidden />
          <p className="font-black uppercase tracking-wide text-gray-400">Gösterilecek ders yok</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
            Yaklaşan antrenman oluşturulduğunda buradan kadroyu görüp yoklama alabilirsiniz.
          </p>
        </div>
      ) : (
        <div className="min-w-0 space-y-5 sm:space-y-6">
          <div className="min-h-[min(420px,65vh)] min-w-0 rounded-[1.75rem] border border-white/5 bg-[#121215] p-5 shadow-xl sm:rounded-[2.5rem] sm:p-8 lg:min-h-[520px]">
            <div className="mb-6 flex min-w-0 flex-col gap-6 border-b border-white/5 pb-6 sm:mb-8 sm:flex-row sm:items-start sm:justify-between sm:pb-8">
              <div className="flex min-w-0 flex-1 items-start gap-4 sm:gap-5">
                <div className="shrink-0 rounded-[1.25rem] bg-[#7c3aed] p-3 text-white shadow-xl shadow-[#7c3aed]/40 sm:rounded-[1.5rem] sm:p-4">
                  <Activity size={24} aria-hidden />
                </div>
                <div className="relative min-w-0 flex-1 space-y-3" ref={lessonMenuRef}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">1 · Ders seçimi</p>
                  <button
                    type="button"
                    onClick={() => setLessonMenuOpen((o) => !o)}
                    className="flex w-full min-w-0 items-start justify-between gap-3 rounded-2xl border border-white/10 bg-[#1c1c21] px-4 py-3.5 text-left transition hover:border-[#7c3aed]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed]/50"
                    aria-expanded={lessonMenuOpen}
                    aria-haspopup="listbox"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-black text-white sm:text-lg">{selectedTraining?.title ?? "Ders seçin"}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="size-3.5 shrink-0 text-[#7c3aed]" aria-hidden />
                          {selectedTraining ? formatTrainingDateTr(selectedTraining.start_time) : "—"}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3.5 shrink-0 text-[#7c3aed]" aria-hidden />
                          {formatTrainingTimeShort(selectedTraining?.start_time)}
                          {selectedTraining?.end_time ? `–${formatTrainingTimeShort(selectedTraining.end_time)}` : ""}
                        </span>
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <MapPin className="size-3.5 shrink-0 text-[#7c3aed]" aria-hidden />
                          <span className="truncate">{selectedTraining?.location?.trim() || "Ana Saha"}</span>
                        </span>
                      </div>
                      {selectedTraining?.coach_display_name?.trim() ? (
                        <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-600">
                          Koç: {selectedTraining.coach_display_name.trim()}
                        </p>
                      ) : null}
                    </div>
                    <ChevronDown
                      className={`mt-1 size-5 shrink-0 text-gray-500 transition ${lessonMenuOpen ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </button>
                  {lessonMenuOpen ? (
                    <div
                      className="absolute left-0 right-0 z-30 mt-2 max-h-[min(60vh,400px)] overflow-y-auto rounded-2xl border border-white/10 bg-[#16161a] py-1 shadow-2xl shadow-black/60"
                      role="listbox"
                    >
                      {trainings.map((t) => {
                        const active = t.id === selectedTrainingId;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            role="option"
                            aria-selected={active}
                            onClick={() => {
                              setSelectedTrainingId(t.id);
                              void loadParticipants(t.id);
                              setLessonMenuOpen(false);
                            }}
                            className={`flex w-full min-w-0 flex-col gap-0.5 border-b border-white/5 px-4 py-3 text-left last:border-0 touch-manipulation ${
                              active ? "bg-[#7c3aed]/15" : "hover:bg-white/[0.04]"
                            }`}
                          >
                            <span className="font-bold text-white">{t.title}</span>
                            <span className="text-[11px] text-gray-500">
                              {formatTrainingDateTr(t.start_time)} · {formatTrainingTimeShort(t.start_time)}
                              {t.end_time ? `–${formatTrainingTimeShort(t.end_time)}` : ""} · {t.location?.trim() || "Ana Saha"}
                            </span>
                            {t.coach_display_name?.trim() ? (
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                                {t.coach_display_name.trim()}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="shrink-0 rounded-2xl border border-white/10 bg-black/30 px-5 py-3 text-center sm:px-6 sm:py-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Kayıtlı kadro</p>
                <p className="mt-0.5 text-2xl font-black tabular-nums text-white sm:text-3xl">{participants.length}</p>
              </div>
            </div>

            {selectedTrainingId ? (
              <div className="mb-5 min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">Özet · tüm kadro</p>
                  {rosterAttendanceSummary.total > 0 ? (
                    <p className="text-[10px] font-semibold tabular-nums text-gray-500">
                      Katılım{" "}
                      %{Math.round((rosterAttendanceSummary.attended / rosterAttendanceSummary.total) * 100)}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-white/5 bg-black/25 px-3 py-2.5 sm:gap-x-4">
                  <span className="inline-flex items-baseline gap-1.5 text-[11px]">
                    <span className="font-bold text-emerald-400/90">Katıldı</span>
                    <span className="font-black tabular-nums text-white">{rosterAttendanceSummary.attended}</span>
                  </span>
                  <span className="text-gray-700" aria-hidden>
                    |
                  </span>
                  <span className="inline-flex items-baseline gap-1.5 text-[11px]">
                    <span className="font-bold text-red-400/90">Gelmedi</span>
                    <span className="font-black tabular-nums text-white">{rosterAttendanceSummary.missed}</span>
                  </span>
                  <span className="text-gray-700" aria-hidden>
                    |
                  </span>
                  <span className="inline-flex items-baseline gap-1.5 text-[11px]">
                    <span className="font-bold text-amber-300/90">Kayıtlı</span>
                    <span className="font-black tabular-nums text-white">{rosterAttendanceSummary.registered}</span>
                  </span>
                  <span className="text-gray-700" aria-hidden>
                    |
                  </span>
                  <span className="inline-flex items-baseline gap-1.5 text-[11px]">
                    <span className="font-bold text-gray-400">İptal</span>
                    <span className="font-black tabular-nums text-white">{rosterAttendanceSummary.cancelled}</span>
                  </span>
                </div>
                {rosterAttendanceSummary.total > 0 ? (
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-emerald-500/80 transition-[width] duration-300"
                      style={{
                        width: `${Math.round((rosterAttendanceSummary.attended / rosterAttendanceSummary.total) * 100)}%`,
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mb-4 min-w-0">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-600">2 · Kadro ve filtre</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,200px)_auto] lg:items-center">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="İsim, pozisyon, takım veya forma no…"
                  className="ui-input min-h-11 w-full min-w-0 bg-black px-3 text-base sm:text-sm"
                />
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as "all" | "registered" | "attended" | "missed" | "cancelled")
                  }
                  className="ui-select min-h-11 w-full min-w-0 bg-black px-3 sm:max-lg:col-span-2 lg:col-span-1"
                >
                  <option value="all">Tüm durumlar</option>
                  <option value="registered">Kayıtlı</option>
                  <option value="attended">Katıldı</option>
                  <option value="missed">Gelmedi</option>
                  <option value="cancelled">İptal</option>
                </select>
                <div className="flex min-h-11 items-center text-[10px] font-bold uppercase text-gray-500 sm:max-lg:col-span-2 lg:justify-end">
                  <span className="tabular-nums text-gray-400">Görünen: {filteredParticipants.length}</span>
                </div>
              </div>
            </div>

            <div className="mb-5 min-w-0">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-600">3 · Toplu yoklama</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                {bulkSaving ? (
                  <span className="flex items-center gap-2 text-[10px] font-bold uppercase text-gray-500 sm:mr-2">
                    <Loader2 className="size-4 animate-spin text-[#7c3aed]" aria-hidden />
                    Kaydediliyor…
                  </span>
                ) : null}
                <button
                  type="button"
                  disabled={bulkSaving || selectedIds.length === 0 || (actorRole === "coach" && !permissions.can_take_attendance)}
                  onClick={() => void applyBulkStatus("attended", true)}
                  title="Yalnızca işaretli satırlar"
                  className="min-h-11 w-full touch-manipulation rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 text-[11px] font-bold uppercase text-emerald-300 disabled:opacity-40 sm:w-auto"
                >
                  Katıldı · seçili
                </button>
                <button
                  type="button"
                  disabled={bulkSaving || selectedIds.length === 0 || (actorRole === "coach" && !permissions.can_take_attendance)}
                  onClick={() => void applyBulkStatus("missed", true)}
                  title="Yalnızca işaretli satırlar"
                  className="min-h-11 w-full touch-manipulation rounded-xl border border-red-500/30 bg-red-500/10 px-3 text-[11px] font-bold uppercase text-red-300 disabled:opacity-40 sm:w-auto"
                >
                  Gelmedi · seçili
                </button>
                <button
                  type="button"
                  disabled={bulkSaving || filteredParticipants.length === 0 || (actorRole === "coach" && !permissions.can_take_attendance)}
                  onClick={() => void applyBulkStatus("registered", false)}
                  title="Şu an filtreyle görünen herkesi kayıtlı durumuna çeker"
                  className="min-h-11 w-full touch-manipulation rounded-xl border border-white/10 bg-white/5 px-3 text-[11px] font-bold uppercase text-gray-300 disabled:opacity-40 sm:w-auto"
                >
                  Kayıtlı · görünenler
                </button>
              </div>
            </div>

            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">4 · Sporcu yoklaması</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {filteredParticipants.length > 0 ? (
                filteredParticipants.map((p) => {
                  const st = normalizedAttendanceStatus(p);
                  return (
                    <div
                      key={`${p.training_id}-${p.profile_id}`}
                      className="group flex min-w-0 flex-col gap-3 rounded-2xl border border-white/5 bg-[#1c1c21] p-4 transition-all sm:flex-row sm:items-stretch sm:justify-between sm:gap-4 sm:p-4 sm:hover:border-white/10"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(p.profile_id)}
                          onChange={(e) =>
                            setSelectedIds((prev) =>
                              e.target.checked ? [...prev, p.profile_id] : prev.filter((id) => id !== p.profile_id)
                            )
                          }
                          className="mt-2.5 size-4 shrink-0 accent-[#7c3aed] touch-manipulation"
                          aria-label={`${p.profiles.full_name ?? "Sporcu"} seç`}
                        />
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-[#121215] text-base font-black italic text-[#7c3aed] sm:size-12 sm:text-lg">
                          {(p.profiles.full_name || "?").charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <span
                            className="block min-w-0 truncate text-[15px] font-bold leading-snug text-white"
                            title={p.profiles.full_name || ""}
                          >
                            {p.profiles.full_name}
                          </span>
                          <span
                            className="block min-w-0 truncate text-[11px] font-medium text-gray-500"
                            title={p.profiles.position || "Pozisyon belirtilmedi"}
                          >
                            {p.profiles.position || "Pozisyon yok"}
                          </span>
                          <p
                            className="truncate text-[10px] font-semibold uppercase tracking-wide text-gray-600"
                            title={
                              [p.profiles.team?.trim() || null, p.profiles.number != null && String(p.profiles.number).trim() !== "" ? `#${p.profiles.number}` : null]
                                .filter(Boolean)
                                .join(" · ") || "Takım / forma no yok"
                            }
                          >
                            {[p.profiles.team?.trim() || null, p.profiles.number != null && String(p.profiles.number).trim() !== "" ? `#${p.profiles.number}` : null]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </p>
                        </div>
                      </div>

                      <div className="flex min-w-0 flex-col gap-2 border-t border-white/5 pt-3 sm:w-[min(100%,260px)] sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase ${
                              st === "attended"
                                ? "border-green-500/25 bg-green-500/10 text-green-400"
                                : st === "missed"
                                  ? "border-red-500/25 bg-red-500/10 text-red-400"
                                  : st === "cancelled"
                                    ? "border-white/10 bg-white/5 text-gray-300"
                                    : "border-amber-500/25 bg-amber-500/10 text-amber-300"
                            }`}
                          >
                            {toAttendanceBadgeLabel(st)}
                          </span>
                          {rowSavingIds.includes(p.profile_id) ? (
                            <Loader2 className="size-4 shrink-0 animate-spin text-[#7c3aed]" aria-hidden />
                          ) : null}
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          <button
                            type="button"
                            onClick={() => void updateAttendance(p.profile_id, "attended")}
                            disabled={(actorRole === "coach" && !permissions.can_take_attendance) || rowSavingIds.includes(p.profile_id)}
                            className={`flex min-h-10 touch-manipulation items-center justify-center rounded-lg text-[9px] font-black uppercase transition-all ${
                              st === "attended"
                                ? "bg-green-500 text-white shadow-md shadow-green-500/20"
                                : "border border-white/10 bg-white/5 text-gray-400 sm:hover:border-green-500/35 sm:hover:text-green-400"
                            }`}
                            title="Katıldı"
                          >
                            <Check size={16} className="shrink-0 sm:mr-0.5" aria-hidden />
                            <span className="sr-only sm:not-sr-only sm:inline">Katıldı</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void updateAttendance(p.profile_id, "missed")}
                            disabled={(actorRole === "coach" && !permissions.can_take_attendance) || rowSavingIds.includes(p.profile_id)}
                            className={`flex min-h-10 touch-manipulation items-center justify-center rounded-lg text-[9px] font-black uppercase transition-all ${
                              st === "missed"
                                ? "bg-red-500 text-white shadow-md shadow-red-500/20"
                                : "border border-white/10 bg-white/5 text-gray-400 sm:hover:border-red-500/35 sm:hover:text-red-400"
                            }`}
                            title="Gelmedi"
                          >
                            <X size={16} className="shrink-0 sm:mr-0.5" aria-hidden />
                            <span className="sr-only sm:not-sr-only sm:inline">Gelmedi</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void updateAttendance(p.profile_id, "registered")}
                            disabled={(actorRole === "coach" && !permissions.can_take_attendance) || rowSavingIds.includes(p.profile_id)}
                            className={`min-h-10 touch-manipulation rounded-lg px-1 text-[9px] font-black uppercase transition-all ${
                              st === "registered"
                                ? "bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/35"
                                : "border border-white/10 bg-white/5 text-gray-500 sm:hover:text-amber-300"
                            }`}
                            title="Henüz işaretlenmedi"
                          >
                            Kayıtlı
                          </button>
                          <button
                            type="button"
                            onClick={() => void updateAttendance(p.profile_id, "cancelled")}
                            disabled={(actorRole === "coach" && !permissions.can_take_attendance) || rowSavingIds.includes(p.profile_id)}
                            className={`min-h-10 touch-manipulation rounded-lg px-1 text-[9px] font-black uppercase transition-all ${
                              st === "cancelled"
                                ? "bg-white/15 text-gray-200 ring-1 ring-white/20"
                                : "border border-white/10 bg-white/5 text-gray-500 sm:hover:text-gray-300"
                            }`}
                            title="İptal"
                          >
                            İptal
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-16 text-center">
                  <Users size={36} className="mx-auto mb-3 text-gray-800" aria-hidden />
                  <p className="text-sm font-bold text-gray-500">Bu filtreyle eşleşen sporcu yok</p>
                  <p className="mx-auto mt-1 max-w-sm text-xs text-gray-600">
                    Arama metnini veya durum filtresini sıfırlayın; kadronun tamamı için &quot;Tüm durumlar&quot;ı seçin.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setStatusFilter("all");
                      }}
                      className="rounded-xl border border-[#7c3aed]/40 bg-[#7c3aed]/15 px-4 py-2 text-[11px] font-bold uppercase text-[#c4b5fd] touch-manipulation hover:bg-[#7c3aed]/25"
                    >
                      Filtreleri sıfırla
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}