"use client";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Calendar,
  Clock,
  Users,
  Check,
  X,
  UserPlus,
  MapPin,
  Activity,
  Loader2,
} from "lucide-react";
import { listAttendanceSnapshot, listTrainingParticipantsSnapshot } from "@/lib/actions/snapshotActions";
import type { ProfileBasic, TrainingParticipantRow, TrainingScheduleRow } from "@/types/domain";
import Notification from "@/components/Notification";
import Link from "next/link";
import { addTrainingParticipant, setAttendanceStatus } from "@/lib/actions/attendanceActions";
import { DEFAULT_COACH_PERMISSIONS } from "@/lib/types";

function toAttendanceBadgeLabel(
  status: "registered" | "attended" | "missed" | "cancelled" | null | undefined
) {
  if (status === "attended") return "KATILDI";
  if (status === "missed") return "GELMEDI";
  if (status === "cancelled") return "IPTAL";
  return "KAYITLI";
}

export default function AntrenmanYonetimi() {
  const searchParams = useSearchParams();
  const requestedTrainingId = searchParams.get("trainingId");
  const [trainings, setTrainings] = useState<TrainingScheduleRow[]>([]);
  const [allPlayers, setAllPlayers] = useState<ProfileBasic[]>([]);
  const [selectedTrainingId, setSelectedTrainingId] = useState<string>("");
  const [participants, setParticipants] = useState<TrainingParticipantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actorRole, setActorRole] = useState<"admin" | "coach" | "sporcu">("sporcu");
  const [permissions, setPermissions] = useState(DEFAULT_COACH_PERMISSIONS);
  
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

    const canViewAllAthletes = resolvedRole !== "coach" || resolvedPermissions.can_view_all_athletes;
    if (canViewAllAthletes) {
      setAllPlayers((snapshot.allPlayers || []) as ProfileBasic[]);
    } else {
      setAllPlayers([]);
    }

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

  // ANTRENMANA OYUNCU EKLEME
  async function addPlayerToTraining(profileId: string) {
    if (!selectedTrainingId) return;
    const result = await addTrainingParticipant(selectedTrainingId, profileId);
    if (result?.success) {
      loadParticipants(selectedTrainingId);
    } else {
      setActionMessage(result?.error || "Sporcu eklenemedi.");
    }
  }

  // YOKLAMA DURUMUNU GÜNCELLEME
  async function updateAttendance(profileId: string, status: "registered" | "attended" | "missed" | "cancelled") {
    if (!selectedTrainingId) return;
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
          Antrenman Planlama ve Dijital Yoklama
        </p>
      </header>
      {actionMessage ? (
        <div className="min-w-0 break-words">
          <Notification message={actionMessage} variant={actionMessage.toLowerCase().includes("basari") ? "success" : "error"} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 min-w-0">
        
        {/* SOL KOLON: PLANLAMA VE ATAMA */}
        <div className="lg:col-span-4 space-y-5 sm:space-y-6 min-w-0">
          
          {/* ANTRENMAN OLUŞTURUCU YONLENDIRME */}
          <div className="bg-[#121215] border border-white/5 p-5 sm:p-6 rounded-[1.75rem] sm:rounded-[2rem] shadow-xl relative overflow-hidden min-w-0">
            <div className="relative z-10">
              <h3 className="text-white font-black italic uppercase tracking-widest text-xs mb-6 flex items-center gap-2">
                <Calendar size={18} className="text-[#7c3aed]" aria-hidden /> Ders Olusturma
              </h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase italic tracking-widest leading-relaxed">
                Ders olusturma akisi merkezi olarak <span className="text-[#7c3aed]">Dersler</span> sayfasina tasindi.
                Burasi yoklama ve katilimci yonetimi icin kullanilir.
              </p>
              <Link
                href="/dersler"
                className="mt-4 inline-flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-2xl bg-[#7c3aed] px-5 py-3 text-[10px] font-black uppercase italic tracking-tighter text-white shadow-lg shadow-[#7c3aed]/20 transition-all sm:w-auto sm:hover:bg-[#6d28d9]"
              >
                <Plus size={14} aria-hidden /> DERSLER SAYFASINA GİT
              </Link>
            </div>
          </div>

          {/* SPORCU HAVUZU (HIZLI EKLE) */}
          <div className="bg-[#121215] border border-white/5 p-5 sm:p-6 rounded-[1.75rem] sm:rounded-[2rem] min-w-0">
            <h3 className="text-white font-black italic uppercase tracking-widest text-xs mb-6 flex items-center gap-2">
              <UserPlus size={18} className="text-[#7c3aed]" aria-hidden /> Gruba Sporcu Ekle
            </h3>
            {actorRole === "coach" && !permissions.can_view_all_athletes && (
              <p className="text-[10px] text-gray-500 font-bold uppercase italic mb-3">Sporcu listesini gorme yetkiniz yok.</p>
            )}
            {actorRole === "coach" && !permissions.can_add_athletes_to_lessons && (
              <p className="text-[10px] text-gray-500 font-bold uppercase italic mb-3">Derse sporcu ekleme yetkiniz yok.</p>
            )}
            <div className="max-h-[350px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {allPlayers.map(p => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => addPlayerToTraining(p.id)}
                  disabled={actorRole === "coach" && (!permissions.can_add_athletes_to_lessons || !permissions.can_view_all_athletes)}
                  className="group flex min-h-[56px] w-full touch-manipulation items-center justify-between gap-2 rounded-2xl border border-transparent bg-white/5 p-4 text-left transition-all sm:min-h-[60px] sm:hover:border-[#7c3aed]/30 sm:hover:bg-[#7c3aed]/10"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 shrink-0 rounded-lg bg-[#1c1c21] flex items-center justify-center text-[10px] font-black text-gray-500 sm:group-hover:text-[#7c3aed]">
                      {p.full_name[0]}
                    </div>
                    <span className="text-xs font-bold text-gray-400 sm:group-hover:text-white uppercase italic break-words min-w-0">
                      {p.full_name}
                    </span>
                  </div>
                  <Plus size={14} className="shrink-0 text-[#7c3aed]" aria-hidden />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SAĞ KOLON: AKTİF YOKLAMA EKRANI */}
        <div className="lg:col-span-8 space-y-5 sm:space-y-6 min-w-0">
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
                    {trainings.map(t => (
                      <option key={t.id} value={t.id} className="bg-[#121215] text-white text-sm font-black uppercase italic">{t.title}</option>
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
                <p className="text-3xl font-black italic text-white leading-none">{participants.length}</p>
              </div>
            </div>

            {/* YOKLAMA LİSTESİ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {participants.length > 0 ? participants.map((p) => (
                <div
                  key={p.id}
                  className="group flex min-h-[88px] min-w-0 flex-col gap-4 rounded-[1.5rem] border border-white/5 bg-[#1c1c21] p-4 transition-all sm:min-h-[92px] sm:flex-row sm:items-center sm:justify-between sm:rounded-[2rem] sm:p-5 sm:hover:border-white/10"
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 shrink-0 rounded-2xl bg-[#121215] flex items-center justify-center font-black text-[#7c3aed] italic border border-white/5 text-base sm:text-lg">
                      {p.profiles.full_name[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span
                        className="block min-w-0 truncate font-black italic text-gray-200 uppercase tracking-tight leading-tight"
                        title={p.profiles.full_name || ""}
                      >
                        {p.profiles.full_name}
                      </span>
                      <span
                        className="block min-w-0 truncate text-[10px] text-gray-600 font-bold uppercase tracking-widest italic"
                        title={p.profiles.position || ""}
                      >
                        {p.profiles.position || "POZISYON BELIRTILMEDI"}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex min-w-0 items-center gap-2 flex-wrap justify-start sm:justify-end w-full sm:w-auto shrink-0">
                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border ${
                      p.attendance_status === "attended"
                        ? "text-green-400 border-green-500/20 bg-green-500/10"
                        : p.attendance_status === "missed"
                        ? "text-red-400 border-red-500/20 bg-red-500/10"
                        : p.attendance_status === "cancelled"
                        ? "text-gray-300 border-white/10 bg-white/5"
                        : "text-amber-300 border-amber-500/20 bg-amber-500/10"
                    }`}>
                      {toAttendanceBadgeLabel(p.attendance_status)}
                    </span>
                    <button 
                      type="button"
                      onClick={() => updateAttendance(p.profile_id, "attended")} 
                      disabled={actorRole === "coach" && !permissions.can_take_attendance}
                      className={`flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-xl transition-all ${p.attendance_status === "attended" ? "bg-green-500 text-white shadow-lg shadow-green-500/20" : "bg-white/5 text-gray-600 sm:hover:text-green-500"}`}
                      title="KATILDI"
                    >
                      <Check size={20} aria-hidden />
                    </button>
                    <button 
                      type="button"
                      onClick={() => updateAttendance(p.profile_id, "missed")} 
                      disabled={actorRole === "coach" && !permissions.can_take_attendance}
                      className={`flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-xl transition-all ${p.attendance_status === "missed" ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "bg-white/5 text-gray-600 sm:hover:text-red-500"}`}
                      title="GELMEDI"
                    >
                      <X size={20} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateAttendance(p.profile_id, "registered")}
                      disabled={actorRole === "coach" && !permissions.can_take_attendance}
                      className={`min-h-11 touch-manipulation rounded-xl px-3 text-[9px] font-black uppercase transition-all ${
                        p.attendance_status === "registered" ? "bg-amber-500/20 text-amber-300" : "bg-white/5 text-gray-500 sm:hover:text-amber-300"
                      }`}
                      title="KAYITLI"
                    >
                      REG
                    </button>
                    <button
                      type="button"
                      onClick={() => updateAttendance(p.profile_id, "cancelled")}
                      disabled={actorRole === "coach" && !permissions.can_take_attendance}
                      className={`min-h-11 touch-manipulation rounded-xl px-3 text-[9px] font-black uppercase transition-all ${
                        p.attendance_status === "cancelled" ? "bg-white/10 text-gray-300" : "bg-white/5 text-gray-500 sm:hover:text-gray-300"
                      }`}
                      title="IPTAL"
                    >
                      CNL
                    </button>
                  </div>
                </div>
              )) : (
                <div className="col-span-2 text-center py-20 bg-white/[0.01] rounded-[2rem] border border-dashed border-white/5">
                   <Users size={40} className="mx-auto mb-4 text-gray-800" aria-hidden />
                   <p className="text-gray-600 font-black italic uppercase tracking-[0.2em] text-sm">Bu ders için henüz sporcu seçilmedi.</p>
                   <p className="text-gray-700 text-[10px] font-bold mt-2">Sol panelden sporcu ekleyerek başlayın.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}