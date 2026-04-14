"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Clock,
  Users,
  Check,
  X,
  MapPin,
  Activity,
  Loader2,
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

function lessonOptionLabel(t: TrainingScheduleRow) {
  const coach = t.coach_display_name?.trim();
  return coach ? `${t.title} · ${coach}` : t.title;
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
  
  const selectedTraining = trainings.find((t) => t.id === selectedTrainingId);

  const loadParticipants = useCallback(async (tId: string) => {
    const snapshot = await listTrainingParticipantsSnapshot(tId, 1, 300);
    if ("error" in snapshot) {
      setActionMessage(snapshot.error || "Katilimci verisi alinamadi.");
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
      setActionMessage(snapshot.error || "Veri alinamadi.");
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
      setActionMessage(result?.error || "Yoklama guncellenemedi.");
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
      setActionMessage("Toplu işlem için sporcu seçilmedi.");
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
    setParticipants((prev) =>
      prev.map((p) =>
        targetIds.includes(p.profile_id)
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
      setActionMessage(`${failed.length} kayıt güncellenemedi; diğerleri başarılı.`);
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
      <header className="min-w-0">
        <h1 className="text-3xl font-black uppercase italic tracking-tighter text-white break-words sm:text-4xl">SAHA YÖNETİMİ</h1>
        <p className="text-gray-500 font-bold text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.4em] mt-2 italic border-l-2 border-[#7c3aed] pl-3 sm:pl-4 break-words">
          Ders seçin, kadroyu filtreleyin ve yoklamayı güncelleyin
        </p>
      </header>
      {actionMessage ? (
        <div className="min-w-0 break-words">
          <Notification message={actionMessage} variant={notificationVariantFromMessage(actionMessage)} />
        </div>
      ) : null}

      <div className="space-y-5 sm:space-y-6 min-w-0">
          <div className="bg-[#121215] border border-white/5 p-5 sm:p-8 rounded-[1.75rem] sm:rounded-[2.5rem] shadow-xl min-h-[min(480px,70vh)] lg:min-h-[560px] min-w-0">
            
            {/* SEÇİLEN ANTRENMAN BİLGİSİ */}
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between mb-8 sm:mb-12 border-b border-white/5 pb-6 sm:pb-10 min-w-0">
              <div className="flex items-start gap-4 sm:gap-6 min-w-0 flex-1">
                <div className="p-3 sm:p-4 shrink-0 bg-[#7c3aed] rounded-[1.25rem] sm:rounded-[1.5rem] text-white shadow-xl shadow-[#7c3aed]/40">
                  <Activity size={26} aria-hidden />
                </div>
                <div className="space-y-2 min-w-0 flex-1">
                  <select 
                    className="min-h-11 w-full max-w-full cursor-pointer touch-manipulation rounded-xl border border-white/10 bg-[#1c1c21] px-3 py-2 text-base font-black uppercase italic tracking-tight text-white outline-none transition-colors focus:border-[#7c3aed]/60 sm:text-lg sm:hover:border-[#7c3aed]/40 md:text-xl"
                    value={selectedTrainingId}
                    onChange={e => { setSelectedTrainingId(e.target.value); loadParticipants(e.target.value); }}
                  >
                    {trainings.map((t) => (
                      <option key={t.id} value={t.id} className="bg-[#121215] text-white text-sm font-black uppercase italic">
                        {lessonOptionLabel(t)}
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 text-[10px] sm:text-xs font-bold text-gray-500 uppercase italic tracking-wide sm:tracking-widest">
                    <span className="flex min-w-0 items-center gap-1"><Clock size={14} className="shrink-0 text-[#7c3aed]" aria-hidden /> {selectedTraining?.start_time ? new Date(selectedTraining.start_time).toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'}) : '--:--'}</span>
                    <span className="flex min-w-0 items-start gap-1"><MapPin size={14} className="mt-0.5 shrink-0 text-[#7c3aed]" aria-hidden /> <span className="break-words">{selectedTraining?.location || "Ana Saha"}</span></span>
                  </div>
                </div>
              </div>
              <div className="bg-white/5 px-5 py-3 sm:px-6 sm:py-4 rounded-2xl text-center shrink-0 w-full sm:w-auto">
                <p className="text-[9px] font-black text-[#7c3aed] uppercase tracking-widest mb-1">Kadro Mevcudu</p>
                <p className="text-3xl font-black italic text-white leading-none tabular-nums">{participants.length}</p>
              </div>
            </div>

            {/* Tüm kadro özeti (A): arama/filtre etkilemez */}
            {selectedTrainingId ? (
              <div className="mb-6 min-w-0 space-y-2">
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600">
                  Yoklama özeti — tüm kadro
                </p>
                <div className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-4">
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-3 sm:px-4 sm:py-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400/90">Katıldı</p>
                    <p className="mt-1 text-2xl font-black italic tabular-nums text-white sm:text-3xl">
                      {rosterAttendanceSummary.attended}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-3 py-3 sm:px-4 sm:py-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-red-400/90">Gelmedi</p>
                    <p className="mt-1 text-2xl font-black italic tabular-nums text-white sm:text-3xl">
                      {rosterAttendanceSummary.missed}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-3 py-3 sm:px-4 sm:py-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-300/90">Kayıtlı</p>
                    <p className="mt-1 text-2xl font-black italic tabular-nums text-white sm:text-3xl">
                      {rosterAttendanceSummary.registered}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 sm:px-4 sm:py-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">İptal</p>
                    <p className="mt-1 text-2xl font-black italic tabular-nums text-white sm:text-3xl">
                      {rosterAttendanceSummary.cancelled}
                    </p>
                  </div>
                </div>
                {rosterAttendanceSummary.total > 0 ? (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-emerald-500/80 transition-[width] duration-300"
                      style={{
                        width: `${Math.round((rosterAttendanceSummary.attended / rosterAttendanceSummary.total) * 100)}%`,
                      }}
                      title={`Katılım: %${Math.round((rosterAttendanceSummary.attended / rosterAttendanceSummary.total) * 100)}`}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,200px)_auto] lg:items-center">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="İsim, pozisyon, takım veya forma no..."
                className="ui-input min-h-11 w-full min-w-0 bg-black px-3 text-base sm:text-sm"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "registered" | "attended" | "missed" | "cancelled")}
                className="ui-select min-h-11 w-full min-w-0 bg-black px-3 sm:max-lg:col-span-2 lg:col-span-1"
              >
                <option value="all">Tüm durumlar</option>
                <option value="registered">Kayıtlı</option>
                <option value="attended">Katıldı</option>
                <option value="missed">Gelmedi</option>
                <option value="cancelled">İptal</option>
              </select>
              <div className="flex min-h-11 items-center text-[10px] font-black uppercase text-gray-400 sm:max-lg:col-span-2 lg:justify-end">
                <span className="tabular-nums">{filteredParticipants.length} sporcu</span>
              </div>
            </div>
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {bulkSaving ? (
                <span className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-500 sm:mr-2">
                  <Loader2 className="size-4 animate-spin text-[#7c3aed]" aria-hidden />
                  Kaydediliyor...
                </span>
              ) : null}
              <button
                type="button"
                disabled={bulkSaving || selectedIds.length === 0 || (actorRole === "coach" && !permissions.can_take_attendance)}
                onClick={() => void applyBulkStatus("attended", true)}
                className="min-h-11 w-full touch-manipulation rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 text-[10px] font-black uppercase text-emerald-300 disabled:opacity-40 sm:w-auto"
              >
                Seçilenleri katıldı yap
              </button>
              <button
                type="button"
                disabled={bulkSaving || selectedIds.length === 0 || (actorRole === "coach" && !permissions.can_take_attendance)}
                onClick={() => void applyBulkStatus("missed", true)}
                className="min-h-11 w-full touch-manipulation rounded-xl border border-red-500/30 bg-red-500/10 px-3 text-[10px] font-black uppercase text-red-300 disabled:opacity-40 sm:w-auto"
              >
                Seçilenleri gelmedi yap
              </button>
              <button
                type="button"
                disabled={bulkSaving || filteredParticipants.length === 0 || (actorRole === "coach" && !permissions.can_take_attendance)}
                onClick={() => void applyBulkStatus("registered", false)}
                className="min-h-11 w-full touch-manipulation rounded-xl border border-white/10 bg-white/5 px-3 text-[10px] font-black uppercase text-gray-300 disabled:opacity-40 sm:w-auto"
              >
                Görünenleri kayıtlıya al
              </button>
            </div>

            {/* YOKLAMA LİSTESİ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredParticipants.length > 0 ? filteredParticipants.map((p) => (
                <div
                  key={`${p.training_id}-${p.profile_id}`}
                  className="group flex min-w-0 flex-col gap-4 rounded-[1.5rem] border border-white/5 bg-[#1c1c21] p-4 transition-all sm:min-h-[92px] sm:flex-row sm:items-stretch sm:justify-between sm:rounded-[2rem] sm:p-5 sm:hover:border-white/10"
                >
                  <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(p.profile_id)}
                      onChange={(e) =>
                        setSelectedIds((prev) =>
                          e.target.checked ? [...prev, p.profile_id] : prev.filter((id) => id !== p.profile_id)
                        )
                      }
                      className="mt-3 size-4 accent-[#7c3aed] shrink-0 touch-manipulation"
                      aria-label={`${p.profiles.full_name} seç`}
                    />
                    <div className="w-11 h-11 sm:w-12 sm:h-12 shrink-0 rounded-2xl bg-[#121215] flex items-center justify-center font-black text-[#7c3aed] italic border border-white/5 text-base sm:text-lg">
                      {(p.profiles.full_name || "?").charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <span
                        className="block min-w-0 truncate font-black italic text-gray-200 uppercase tracking-tight leading-tight"
                        title={p.profiles.full_name || ""}
                      >
                        {p.profiles.full_name}
                      </span>
                      <span
                        className="block min-w-0 truncate text-[10px] text-gray-600 font-bold uppercase tracking-widest italic"
                        title={p.profiles.position || "Pozisyon belirtilmedi"}
                      >
                        {p.profiles.position || "Pozisyon belirtilmedi"}
                      </span>
                      <p
                        className="text-[9px] font-bold uppercase tracking-wide text-gray-500 truncate"
                        title={[p.profiles.team?.trim() || null, p.profiles.number != null && String(p.profiles.number).trim() !== "" ? `#${p.profiles.number}` : null]
                          .filter(Boolean)
                          .join(" · ") || "Takım / forma no yok"}
                      >
                        {[p.profiles.team?.trim() || null, p.profiles.number != null && String(p.profiles.number).trim() !== "" ? `#${p.profiles.number}` : null]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex min-w-0 flex-col gap-3 border-t border-white/5 pt-3 sm:w-[min(100%,280px)] sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0 shrink-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border ${
                          p.attendance_status === "attended"
                            ? "text-green-400 border-green-500/20 bg-green-500/10"
                            : p.attendance_status === "missed"
                              ? "text-red-400 border-red-500/20 bg-red-500/10"
                              : p.attendance_status === "cancelled"
                                ? "text-gray-300 border-white/10 bg-white/5"
                                : "text-amber-300 border-amber-500/20 bg-amber-500/10"
                        }`}
                      >
                        {toAttendanceBadgeLabel(p.attendance_status)}
                      </span>
                      {rowSavingIds.includes(p.profile_id) ? (
                        <Loader2 className="size-4 shrink-0 animate-spin text-[#7c3aed]" aria-hidden />
                      ) : null}
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <button 
                      type="button"
                      onClick={() => updateAttendance(p.profile_id, "attended")} 
                      disabled={(actorRole === "coach" && !permissions.can_take_attendance) || rowSavingIds.includes(p.profile_id)}
                      className={`flex min-h-11 touch-manipulation items-center justify-center gap-1 rounded-xl text-[9px] font-black uppercase transition-all ${p.attendance_status === "attended" ? "bg-green-500 text-white shadow-lg shadow-green-500/20" : "border border-white/10 bg-white/5 text-gray-400 sm:hover:border-green-500/30 sm:hover:text-green-400"}`}
                      title="Katıldı"
                    >
                      <Check size={18} className="shrink-0" aria-hidden />
                      <span className="max-[380px]:sr-only">Katıldı</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => updateAttendance(p.profile_id, "missed")} 
                      disabled={(actorRole === "coach" && !permissions.can_take_attendance) || rowSavingIds.includes(p.profile_id)}
                      className={`flex min-h-11 touch-manipulation items-center justify-center gap-1 rounded-xl text-[9px] font-black uppercase transition-all ${p.attendance_status === "missed" ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "border border-white/10 bg-white/5 text-gray-400 sm:hover:border-red-500/30 sm:hover:text-red-400"}`}
                      title="Gelmedi"
                    >
                      <X size={18} className="shrink-0" aria-hidden />
                      <span className="max-[380px]:sr-only">Gelmedi</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateAttendance(p.profile_id, "registered")}
                      disabled={(actorRole === "coach" && !permissions.can_take_attendance) || rowSavingIds.includes(p.profile_id)}
                      className={`min-h-11 touch-manipulation rounded-xl px-2 text-[9px] font-black uppercase transition-all ${
                        p.attendance_status === "registered" ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30" : "border border-white/10 bg-white/5 text-gray-500 sm:hover:text-amber-300"
                      }`}
                      title="Kayıtlı (henüz işaretlenmedi)"
                    >
                      Kayıtlı
                    </button>
                    <button
                      type="button"
                      onClick={() => updateAttendance(p.profile_id, "cancelled")}
                      disabled={(actorRole === "coach" && !permissions.can_take_attendance) || rowSavingIds.includes(p.profile_id)}
                      className={`min-h-11 touch-manipulation rounded-xl px-2 text-[9px] font-black uppercase transition-all ${
                        p.attendance_status === "cancelled" ? "bg-white/15 text-gray-200 ring-1 ring-white/20" : "border border-white/10 bg-white/5 text-gray-500 sm:hover:text-gray-300"
                      }`}
                      title="İptal"
                    >
                      İptal
                    </button>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="col-span-2 text-center py-20 bg-white/[0.01] rounded-[2rem] border border-dashed border-white/5">
                   <Users size={40} className="mx-auto mb-4 text-gray-800" aria-hidden />
                   <p className="text-gray-600 font-black italic uppercase tracking-[0.2em] text-sm">Bu filtrede sporcu bulunamadı.</p>
                   <p className="text-gray-700 text-[10px] font-bold mt-2">Arama ve durum filtresini temizleyerek tekrar deneyin.</p>
                </div>
              )}
            </div>
          </div>
      </div>
    </div>
  );
}