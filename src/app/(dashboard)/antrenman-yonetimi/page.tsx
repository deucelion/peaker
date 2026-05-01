"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  ArrowLeft,
  Search,
} from "lucide-react";
import { listAttendanceSnapshot, listLessonsSnapshot, listTrainingParticipantsSnapshot } from "@/lib/actions/snapshotActions";
import { listPrivateLessonPackagesForManagement } from "@/lib/actions/privateLessonPackageActions";
import type { TrainingParticipantRow, TrainingScheduleRow } from "@/types/domain";
import type { PrivateLessonPackage } from "@/lib/types";
import Notification from "@/components/Notification";
import EmptyStateCard from "@/components/EmptyStateCard";
import { setAttendanceStatus } from "@/lib/actions/attendanceActions";
import { DEFAULT_COACH_PERMISSIONS } from "@/lib/types";
import { cancelLesson, getLessonManagementDetail, hardDeleteLesson } from "@/lib/actions/lessonActions";
import WeeklyLessonSchedulePage from "../haftalik-ders-programi/page";
import LessonsPage from "../dersler/page";
import ProgramNotesPage from "../notlar-haftalik-program/page";

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

function participantInitials(name: string) {
  const clean = name.trim();
  if (!clean) return "SP";
  const parts = clean.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "";
  const second = parts[1]?.[0] || "";
  return `${first}${second}`.toUpperCase() || clean.slice(0, 2).toUpperCase();
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

type TrainingWorkspaceView =
  | "takvim"
  | "ders-listesi"
  | "ders-olustur"
  | "yoklama"
  | "notlar"
  | "paket-listesi"
  | "planlama"
  | "paketler"
  | "kullanim"
  | "tahsilat";

const VALID_TRAINING_VIEWS: TrainingWorkspaceView[] = [
  "takvim",
  "ders-listesi",
  "ders-olustur",
  "yoklama",
  "notlar",
  "paket-listesi",
  "planlama",
  "paketler",
  "kullanim",
  "tahsilat",
];

export default function AntrenmanYonetimi() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedTrainingId = searchParams.get("trainingId");
  const requestedLessonId = searchParams.get("lessonId");
  const requestedPackageId = searchParams.get("packageId");
  const rawModuleView = searchParams.get("modul") || "haftalik-takvim";
  const requestedView = searchParams.get("view");
  const moduleView = useMemo(() => {
    if (rawModuleView === "ders-operasyonu") return "grup-dersleri";
    if (rawModuleView === "ozel-ders-servisi") return "ozel-dersler";
    if (
      rawModuleView === "grup-dersleri" ||
      rawModuleView === "ozel-dersler" ||
      rawModuleView === "haftalik-takvim" ||
      rawModuleView === "notlar"
    ) {
      return rawModuleView;
    }
    return "haftalik-takvim";
  }, [rawModuleView]);

  const contentTopRef = useRef<HTMLDivElement>(null);
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
  const moduleTabs = [
    { key: "haftalik-takvim", label: "Haftalık Takvim", href: "/antrenman-yonetimi?modul=haftalik-takvim&view=takvim" },
    { key: "grup-dersleri", label: "Grup Dersleri", href: "/antrenman-yonetimi?modul=grup-dersleri&view=ders-listesi" },
    { key: "ozel-dersler", label: "Özel Dersler", href: "/antrenman-yonetimi?modul=ozel-dersler&view=paket-listesi" },
    { key: "notlar", label: "Notlar", href: "/antrenman-yonetimi?modul=notlar" },
  ] as const;
  const activeWorkspaceView: TrainingWorkspaceView =
    requestedView && VALID_TRAINING_VIEWS.includes(requestedView as TrainingWorkspaceView)
      ? (requestedView as TrainingWorkspaceView)
      : moduleView === "ozel-dersler"
        ? "paket-listesi"
        : moduleView === "grup-dersleri"
          ? "ders-listesi"
        : moduleView === "notlar"
          ? "notlar"
          : "takvim";

  const moduleContextTabs =
    moduleView === "ozel-dersler"
      ? [
          { key: "paket-listesi", label: "Paket Listesi" },
          { key: "planlama", label: "Planlama" },
          { key: "kullanim", label: "Kullanım" },
          { key: "tahsilat", label: "Tahsilat" },
        ]
      : moduleView === "grup-dersleri"
        ? [
          { key: "ders-listesi", label: "Ders Listesi" },
          { key: "ders-olustur", label: "Ders Oluştur" },
          { key: "yoklama", label: "Yoklama" },
          ]
        : moduleView === "notlar"
          ? [{ key: "notlar", label: "Notlar" }]
        : [{ key: "takvim", label: "Takvim Operasyonu" }];

  useEffect(() => {
    if (!requestedView) return;
    // Geriye uyumluluk: eski "grup dersleri + takvim" çağrıları artık üst seviye "haftalık takvim"e yönlenir.
    if (moduleView === "grup-dersleri" && requestedView === "takvim") {
      const next = new URLSearchParams(searchParams.toString());
      next.set("modul", "haftalik-takvim");
      next.set("view", "takvim");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      return;
    }
    // Geriye uyumluluk: eski "grup dersleri + notlar" çağrıları doğrudan notlar modülüne taşınır.
    if (moduleView === "grup-dersleri" && requestedView === "notlar") {
      router.replace("/notlar-haftalik-program", { scroll: false });
    }
  }, [moduleView, requestedView, pathname, router, searchParams]);

  useEffect(() => {
    if (!requestedView) return;
    if (moduleView !== "ozel-dersler") return;
    if (requestedView === "planli-oturumlar" || requestedView === "ozel-yoklama" || requestedView === "paketler") {
      const next = new URLSearchParams(searchParams.toString());
      next.set("view", requestedView === "paketler" ? "paket-listesi" : "planlama");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }
  }, [moduleView, pathname, requestedView, router, searchParams]);

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

  useEffect(() => {
    if (!contentTopRef.current) return;
    contentTopRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeWorkspaceView]);

  function updateWorkspaceView(view: TrainingWorkspaceView) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("modul", moduleView);
    next.set("view", view);
    if (view !== "ders-listesi") next.delete("lessonId");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function openGroupLessonDetail(lessonId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("modul", "grup-dersleri");
    next.set("view", "ders-listesi");
    next.set("lessonId", lessonId);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function closeGroupLessonDetail() {
    const next = new URLSearchParams(searchParams.toString());
    next.set("modul", "grup-dersleri");
    next.set("view", "ders-listesi");
    next.delete("lessonId");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

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

  function renderWorkspaceContent() {
    if (moduleView === "ozel-dersler") {
      return (
        <PrivateLessonsWorkspaceView
          view={activeWorkspaceView}
          packageId={requestedPackageId}
        />
      );
    }
    if (moduleView === "notlar") return <ProgramNotesPage />;
    if (moduleView === "haftalik-takvim") return <WeeklyLessonSchedulePage />;
    if (activeWorkspaceView === "ders-listesi") {
      return (
        <GroupLessonsWorkspaceListDetail
          lessonId={requestedLessonId}
          onOpenLesson={openGroupLessonDetail}
          onBackToList={closeGroupLessonDetail}
        />
      );
    }
    if (activeWorkspaceView === "ders-olustur") return <LessonsPage />;
    if (activeWorkspaceView === "notlar") return <ProgramNotesPage />;

    return trainings.length === 0 ? (
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
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Ders seçimi</p>
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
              <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Bu dersteki kadro</p>
              <p className="mt-0.5 text-2xl font-black tabular-nums text-white sm:text-3xl">{participants.length}</p>
            </div>
          </div>

          {selectedTrainingId ? (
            <div className="mb-5 min-w-0">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">Özet · tüm kadro</p>
                {rosterAttendanceSummary.total > 0 ? (
                  <p className="text-[10px] font-semibold tabular-nums text-gray-500">
                    Katılım %{Math.round((rosterAttendanceSummary.attended / rosterAttendanceSummary.total) * 100)}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-white/5 bg-black/25 px-3 py-2.5 sm:gap-x-4">
                <span className="inline-flex items-baseline gap-1.5 text-[11px]">
                  <span className="font-bold text-emerald-400/90">Katıldı</span>
                  <span className="font-black tabular-nums text-white">{rosterAttendanceSummary.attended}</span>
                </span>
                <span className="text-gray-700" aria-hidden>|</span>
                <span className="inline-flex items-baseline gap-1.5 text-[11px]">
                  <span className="font-bold text-red-400/90">Gelmedi</span>
                  <span className="font-black tabular-nums text-white">{rosterAttendanceSummary.missed}</span>
                </span>
                <span className="text-gray-700" aria-hidden>|</span>
                <span className="inline-flex items-baseline gap-1.5 text-[11px]">
                  <span className="font-bold text-amber-300/90">Kayıtlı</span>
                  <span className="font-black tabular-nums text-white">{rosterAttendanceSummary.registered}</span>
                </span>
                <span className="text-gray-700" aria-hidden>|</span>
                <span className="inline-flex items-baseline gap-1.5 text-[11px]">
                  <span className="font-bold text-gray-400">İptal</span>
                  <span className="font-black tabular-nums text-white">{rosterAttendanceSummary.cancelled}</span>
                </span>
              </div>
              {rosterAttendanceSummary.total > 0 ? (
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-emerald-500/80 transition-[width] duration-300"
                    style={{ width: `${Math.round((rosterAttendanceSummary.attended / rosterAttendanceSummary.total) * 100)}%` }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mb-4 min-w-0">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-600">Kadro ve filtre</p>
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
                onChange={(e) => setStatusFilter(e.target.value as "all" | "registered" | "attended" | "missed" | "cancelled")}
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
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-600">Toplu yoklama</p>
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

          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">Sporcu yoklaması</p>
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
                          setSelectedIds((prev) => (e.target.checked ? [...prev, p.profile_id] : prev.filter((id) => id !== p.profile_id)))
                        }
                        className="mt-2.5 size-4 shrink-0 accent-[#7c3aed] touch-manipulation"
                        aria-label={`${p.profiles.full_name ?? "Sporcu"} seç`}
                      />
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-[#121215] text-base font-black italic text-[#7c3aed] sm:size-12 sm:text-lg">
                        {(p.profiles.full_name || "?").charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <span className="block min-w-0 truncate text-[15px] font-bold leading-snug text-white" title={p.profiles.full_name || ""}>
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
                            [
                              p.profiles.team?.trim() || null,
                              p.profiles.number != null && String(p.profiles.number).trim() !== "" ? `#${p.profiles.number}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "Takım / forma no yok"
                          }
                        >
                          {[
                            p.profiles.team?.trim() || null,
                            p.profiles.number != null && String(p.profiles.number).trim() !== "" ? `#${p.profiles.number}` : null,
                          ]
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
                        {rowSavingIds.includes(p.profile_id) ? <Loader2 className="size-4 shrink-0 animate-spin text-[#7c3aed]" aria-hidden /> : null}
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
    );
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
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">Ders merkezi</p>
          <h1 className="text-2xl font-black uppercase italic tracking-tighter text-white break-words sm:text-3xl">
            Ders <span className="text-[#7c3aed]">Yönetimi</span>
          </h1>
          <p className="mt-2 border-l-2 border-[#7c3aed] pl-3 text-sm font-medium text-gray-500 sm:pl-4 sm:text-base">
            Haftalık takvim, grup dersleri ve özel ders operasyonunu tek merkezden yönetin.
          </p>
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {moduleTabs.map((tab) => {
              const isActive = moduleView === tab.key;
              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  className={`inline-flex min-h-10 items-center rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-wide ${
                    isActive
                      ? "border-[#7c3aed]/40 bg-[#7c3aed]/10 text-[#c4b5fd]"
                      : "border-white/10 bg-white/[0.03] text-gray-300 hover:text-white"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {moduleContextTabs.map((tab) => {
              const isActive = activeWorkspaceView === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => updateWorkspaceView(tab.key as TrainingWorkspaceView)}
                  className={`inline-flex min-h-10 items-center rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-wide ${
                    isActive
                      ? "border-[#7c3aed]/40 bg-[#7c3aed]/10 text-[#c4b5fd]"
                      : "border-white/10 bg-white/[0.03] text-gray-300 hover:text-white"
                  }`}
                  aria-pressed={isActive}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-[10px] font-semibold text-gray-400">
          Aktif bağlam:{" "}
          <span className="font-black text-[#c4b5fd]">
            {moduleView === "haftalik-takvim"
              ? "Haftalık Takvim · Operasyon"
              : moduleView === "ozel-dersler"
              ? `Özel Dersler · ${
                  activeWorkspaceView === "paket-listesi"
                    ? requestedPackageId
                      ? "Paket Detayı"
                      : "Paket Listesi"
                    : activeWorkspaceView === "planlama"
                    ? "Planlama"
                      : activeWorkspaceView === "kullanim"
                        ? "Kullanım"
                        : activeWorkspaceView === "tahsilat"
                          ? "Tahsilat"
                          : "Paket Yönetimi"
                }`
              : moduleView === "notlar"
                ? "Notlar"
              : `Grup Dersleri · ${
                  activeWorkspaceView === "ders-listesi"
                    ? "Ders Listesi"
                    : activeWorkspaceView === "ders-olustur"
                      ? "Ders Oluştur"
                      : "Yoklama"
                }`}
          </span>
        </div>
      </header>
      {actionMessage ? (
        <div className="min-w-0 break-words">
          <Notification message={actionMessage} variant={notificationVariantFromMessage(actionMessage)} />
        </div>
      ) : null}
      <div ref={contentTopRef} />

      {renderWorkspaceContent()}
    </div>
  );
}

function GroupLessonsWorkspaceListDetail({
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
                {new Date(lesson.startTime).toLocaleDateString("tr-TR")} · {new Date(lesson.startTime).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
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
                    <div key={participant.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
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
        {error ? <div className="mt-4"><Notification message={error} variant="error" /></div> : null}
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
            onChange={(e) => setStatusFilter(e.target.value as "all" | "scheduled" | "completed" | "cancelled")}
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
      {error ? <div className="mt-3"><Notification message={error} variant="error" /></div> : null}
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
              <button
                type="button"
                onClick={() => onOpenLesson(lesson.id)}
                className="w-full text-left"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-black uppercase text-white">{lesson.title}</p>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${
                    lesson.status === "cancelled" ? "border-rose-500/40 bg-rose-500/10 text-rose-200" :
                    lesson.status === "completed" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" :
                    "border-amber-500/40 bg-amber-500/10 text-amber-200"
                  }`}>
                    {lesson.status === "cancelled" ? "İptal Edildi" : lesson.status === "completed" ? "Tamamlandı" : "Planlandı"}
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-semibold text-gray-300">
                  {new Date(lesson.startTime).toLocaleDateString("tr-TR")} · {new Date(lesson.startTime).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}-
                  {new Date(lesson.endTime).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                </p>
                <div className="mt-2 grid gap-1 text-[11px] font-semibold text-gray-400 sm:grid-cols-2">
                  <p>Koç: <span className="text-gray-200">{lesson.coachName}</span></p>
                  <p>Lokasyon: <span className="text-gray-200">{lesson.location}</span></p>
                  <p>Kapasite/Kayıtlı: <span className="text-gray-200">{lesson.capacity}/{lesson.participantCount}</span></p>
                  <p>Yoklama: <span className="text-gray-200">
                    {lesson.status === "completed"
                      ? "Tamamlandı"
                      : lesson.status === "cancelled"
                        ? "İptal"
                        : (lesson.registeredCount ?? 0) > 0
                          ? `Bekliyor (${lesson.registeredCount})`
                          : "Hazır"}
                  </span></p>
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

function PrivateLessonsWorkspaceView({
  view,
  packageId,
}: {
  view: TrainingWorkspaceView;
  packageId: string | null;
}) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PrivateLessonPackage[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await listPrivateLessonPackagesForManagement();
    if ("error" in res) {
      setError(res.error || "Özel ders paketleri alınamadı.");
      setRows([]);
      setLoading(false);
      return;
    }
    setError(null);
    setRows(res.packages || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void load();
    }, 0);
    return () => clearTimeout(id);
  }, [load]);

  const activeRows = useMemo(() => rows.filter((p) => p.isActive), [rows]);
  const doneRows = useMemo(() => rows.filter((p) => !p.isActive), [rows]);

  const usageRows = useMemo(() => {
    return [...rows].sort((a, b) => b.usedLessons - a.usedLessons);
  }, [rows]);

  const paymentRows = useMemo(() => {
    return [...rows].sort((a, b) => (b.totalPrice - b.amountPaid) - (a.totalPrice - a.amountPaid));
  }, [rows]);
  const overdueLikeRows = useMemo(
    () => rows.filter((p) => p.paymentStatus === "partial" || p.paymentStatus === "unpaid").length,
    [rows]
  );
  const selectedPackage = useMemo(() => rows.find((p) => p.id === packageId) || null, [rows, packageId]);
  const planDate = searchParams.get("planDate") || "";
  const planTime = searchParams.get("planTime") || "";
  const hasCalendarPrefill = Boolean(planDate && planTime);
  const detailHrefFor = (pkgId: string) =>
    `/ozel-ders-paketleri/${pkgId}?from=antrenman-yonetimi&returnView=${encodeURIComponent(view || "paket-listesi")}`;

  if (loading) {
    return (
      <div className="rounded-[1.75rem] border border-white/10 bg-[#121215] px-6 py-16 text-center sm:rounded-[2rem]">
        <Loader2 className="mx-auto mb-4 size-10 animate-spin text-[#7c3aed]" aria-hidden />
        <p className="text-sm font-bold text-gray-400">Özel ders çalışma alanı yükleniyor…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[1.75rem] border border-white/10 bg-[#121215] p-5 sm:rounded-[2rem]">
        <Notification message={error} variant="error" />
      </div>
    );
  }

  if (selectedPackage) {
    const remainingPayment = Math.max(selectedPackage.totalPrice - selectedPackage.amountPaid, 0);
    const returnHref = `/antrenman-yonetimi?modul=ozel-dersler&view=${encodeURIComponent(
      view || "paket-listesi"
    )}`;
    const detailHref = `/ozel-ders-paketleri/${selectedPackage.id}?from=antrenman-yonetimi&returnView=${encodeURIComponent(
      view || "paket-listesi"
    )}`;
    return (
      <section className="rounded-[1.75rem] border border-white/10 bg-[#121215] p-5 sm:rounded-[2rem] sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={returnHref}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 text-[10px] font-black uppercase tracking-wide text-gray-300"
          >
            <ArrowLeft size={14} aria-hidden />
            Listeye dön
          </Link>
          <Link
            href={`${detailHref}${
              hasCalendarPrefill
                ? `&tab=plan&lessonDate=${encodeURIComponent(planDate)}&startClock=${encodeURIComponent(planTime)}`
                : ""
            }`}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#7c3aed]/35 bg-[#7c3aed]/20 px-3 text-[10px] font-black uppercase tracking-wide text-[#ddd6fe]"
          >
            Paket Detayına Git
          </Link>
        </div>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 sm:p-5">
          <p className="text-lg font-black uppercase text-white">{selectedPackage.athleteName}</p>
          <p className="mt-1 text-[11px] font-semibold text-gray-300">{selectedPackage.packageName}</p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wide text-gray-500">Kalan Ders</p>
              <p className="mt-1 text-[11px] font-semibold text-white">{selectedPackage.remainingLessons}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wide text-gray-500">Kullanılan / Toplam</p>
              <p className="mt-1 text-[11px] font-semibold text-white">
                {selectedPackage.usedLessons} / {selectedPackage.totalLessons}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wide text-gray-500">Koç</p>
              <p className="mt-1 text-[11px] font-semibold text-white">{selectedPackage.coachName || "Koç atanmadı"}</p>
            </div>
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wide text-amber-200">Kalan Ödeme</p>
              <p className="mt-1 text-[11px] font-semibold text-white">₺{remainingPayment.toLocaleString("tr-TR")}</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] font-semibold text-gray-500">
            Bu alan yalnızca özet görünümüdür. Planlama, kullanım, tahsilat ve paket ayarları için paket detay ekranını kullanın.
          </p>
        </div>
      </section>
    );
  }

  if (view === "planlama") {
    return (
      <section className="rounded-[1.75rem] border border-white/10 bg-[#121215] p-5 sm:rounded-[2rem] sm:p-6">
        <h2 className="text-sm font-black uppercase text-white">Planlama</h2>
        <p className="mt-1 text-[11px] font-semibold text-gray-500">Planlama için önce aktif paketi seçin, ardından paket detayından oturumu başlatın.</p>
        {hasCalendarPrefill ? (
          <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-100">
            Takvimden gelen zaman: {planDate} · {planTime}. Aşağıdan bir paket seçip planı bu zamanla başlatabilirsiniz.
          </div>
        ) : null}
        <div className="mt-4 grid gap-3">
          {activeRows.length === 0 ? (
            <EmptyStateCard
              title="Kayıt bulunamadı"
              description="Planlama için aktif özel ders paketi bulunamadı."
              reason="Henüz paket oluşturulmamış veya tüm paketler tamamlanmış olabilir."
              primaryAction={{ label: "Paket oluştur", href: "/ozel-ders-paketleri" }}
              secondaryAction={{ label: "Paket listesi", href: "/antrenman-yonetimi?modul=ozel-dersler&view=paket-listesi" }}
              compact
            />
          ) : (
            activeRows.map((pkg) => (
              <div key={pkg.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] font-bold text-gray-300">
                <p className="text-white">{pkg.packageName}</p>
                <p className="mt-1 text-gray-500">{pkg.athleteName} · Koç: {pkg.coachName || "—"}</p>
                <p className="mt-1 text-gray-500">Kalan ders: {pkg.remainingLessons} / {pkg.totalLessons}</p>
                <Link
                  href={detailHrefFor(pkg.id)}
                  className="mt-2 inline-flex rounded-lg border border-[#7c3aed]/35 bg-[#7c3aed]/20 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#ddd6fe]"
                >
                  Paket Detayına Git
                </Link>
              </div>
            ))
          )}
        </div>
      </section>
    );
  }

  if (view === "kullanim") {
    return (
      <section className="rounded-[1.75rem] border border-white/10 bg-[#121215] p-5 sm:rounded-[2rem] sm:p-6">
        <h2 className="text-sm font-black uppercase text-white">Kullanım</h2>
        <p className="mt-1 text-[11px] font-semibold text-gray-500">Paket kullanım yoğunluğunu ve kalan ders dengesini izleyin.</p>
        <div className="mt-4 grid gap-3">
          {usageRows.length === 0 ? (
            <EmptyStateCard
              title="Kayıt bulunamadı"
              description="Kullanım görünümünde listelenecek paket verisi bulunamadı."
              reason="Özel ders paketi olmadığı için kullanım kaydı oluşmamış olabilir."
              primaryAction={{ label: "Paket oluştur", href: "/ozel-ders-paketleri" }}
              secondaryAction={{ label: "Paket listesi", href: "/antrenman-yonetimi?modul=ozel-dersler&view=paket-listesi" }}
              compact
            />
          ) : (
            usageRows.map((pkg) => (
              <div key={pkg.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] font-bold text-gray-300">
                <p className="text-white">{pkg.packageName}</p>
                <p className="mt-1 text-gray-500">{pkg.athleteName} · Kullanılan: {pkg.usedLessons}</p>
                <p className="mt-1 text-gray-500">Kalan: {pkg.remainingLessons} · Toplam: {pkg.totalLessons}</p>
                <Link
                  href={detailHrefFor(pkg.id)}
                  className="mt-2 inline-flex rounded-lg border border-[#7c3aed]/35 bg-[#7c3aed]/20 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#ddd6fe]"
                >
                  Paket Detayına Git
                </Link>
              </div>
            ))
          )}
        </div>
      </section>
    );
  }

  if (view === "tahsilat") {
    return (
      <section className="rounded-[1.75rem] border border-white/10 bg-[#121215] p-5 sm:rounded-[2rem] sm:p-6">
        <h2 className="text-sm font-black uppercase text-white">Tahsilat</h2>
        <p className="mt-1 text-[11px] font-semibold text-gray-500">Paket bazlı tahsilat durumunu ve kalan bakiyeyi takip edin.</p>
        <div className="mt-4 grid gap-3">
          {paymentRows.length === 0 ? (
            <EmptyStateCard
              title="Kayıt bulunamadı"
              description="Tahsilat görünümünde listelenecek paket kaydı bulunamadı."
              reason="Özel ders paketi olmadığı için tahsilat verisi oluşmamış olabilir."
              primaryAction={{ label: "Paket oluştur", href: "/ozel-ders-paketleri" }}
              secondaryAction={{ label: "Paket listesi", href: "/antrenman-yonetimi?modul=ozel-dersler&view=paket-listesi" }}
              compact
            />
          ) : (
            paymentRows.map((pkg) => (
              <div key={pkg.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-[11px] font-bold text-gray-300">
                <p className="text-white">{pkg.packageName}</p>
                <p className="mt-1 text-gray-500">{pkg.athleteName} · Ödenen: ₺{pkg.amountPaid.toLocaleString("tr-TR")}</p>
                <p className="mt-1 text-gray-500">Kalan ödeme: ₺{Math.max(pkg.totalPrice - pkg.amountPaid, 0).toLocaleString("tr-TR")}</p>
                <Link
                  href={detailHrefFor(pkg.id)}
                  className="mt-2 inline-flex rounded-lg border border-[#7c3aed]/35 bg-[#7c3aed]/20 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#ddd6fe]"
                >
                  Paket Detayına Git
                </Link>
              </div>
            ))
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-[#121215] p-5 sm:rounded-[2rem] sm:p-6">
      <h2 className="text-sm font-black uppercase text-white">Paket Listesi</h2>
      <p className="mt-1 text-[11px] font-semibold text-gray-500">Özel ders operasyonu için önce paketi seçin, sonra detaydan işlem yapın.</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-wide text-gray-500">Toplam Paket</p>
          <p className="mt-1 text-lg font-black text-white">{rows.length}</p>
        </div>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-wide text-emerald-200">Aktif</p>
          <p className="mt-1 text-lg font-black text-white">{activeRows.length}</p>
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-wide text-amber-200">Tahsilat Bekleyen</p>
          <p className="mt-1 text-lg font-black text-white">{overdueLikeRows}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-wide text-gray-500">Tamamlanan</p>
          <p className="mt-1 text-lg font-black text-white">{doneRows.length}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        {activeRows.length === 0 && doneRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center">
            <p className="text-[12px] font-bold text-gray-400">Aktif özel ders paketi bulunmuyor.</p>
            <p className="mt-1 text-[11px] font-semibold text-gray-500">
              Operasyona başlamak için önce bir paket oluşturun.
            </p>
            <Link
              href="/ozel-ders-paketleri"
              className="mt-3 inline-flex rounded-lg border border-[#7c3aed]/35 bg-[#7c3aed]/20 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-[#ddd6fe]"
            >
              Yeni Paket Oluştur
            </Link>
          </div>
        ) : (
          [...activeRows, ...doneRows].map((pkg) => (
            <div key={pkg.id} className="rounded-xl border border-white/10 bg-black/20 p-4 text-[11px] font-bold text-gray-300 transition hover:border-[#7c3aed]/35 hover:bg-[#7c3aed]/10">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-black uppercase text-white">{pkg.athleteName}</p>
                  <p className="mt-1 text-[11px] font-semibold text-gray-300">
                    Kalan Ders: <span className="text-white">{pkg.remainingLessons}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${
                    pkg.isActive
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                      : "border-white/15 bg-white/5 text-gray-300"
                  }`}>
                    {pkg.isActive ? "Aktif" : "Tamamlandı"}
                  </span>
                  {pkg.isActive && pkg.remainingLessons > 0 && pkg.remainingLessons <= 2 ? (
                    <span className="inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase text-amber-200">
                      Az Ders
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-2 grid gap-1 text-[11px] font-semibold text-gray-400">
                <p>{pkg.packageName} · <span className="text-gray-200">Koç: {pkg.coachName || "Koç atanmadı"}</span></p>
              </div>

              <div className="mt-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-wide text-gray-500">Operasyon Özeti</p>
                <div className="mt-1 grid gap-1 text-[11px] font-semibold text-gray-300 sm:grid-cols-2">
                  <p>Kullanılan/Toplam: <span className="text-white">{pkg.usedLessons}/{pkg.totalLessons}</span></p>
                  <p>Ödeme: <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[9px] font-black uppercase ${
                    pkg.paymentStatus === "paid"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                      : pkg.paymentStatus === "partial"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                        : "border-rose-500/40 bg-rose-500/10 text-rose-200"
                  }`}>
                    {pkg.paymentStatus === "paid" ? "Ödeme Tamamlandı" : pkg.paymentStatus === "partial" ? "Kısmi Ödeme" : "Ödeme Bekleniyor"}
                  </span></p>
                  <p>Kalan Ödeme: <span className="text-white">₺{Math.max(pkg.totalPrice - pkg.amountPaid, 0).toLocaleString("tr-TR")}</span></p>
                  <p>
                    Yaklaşan Planlı Ders:{" "}
                    <span className="text-gray-200">Paket detayında görüntüleyin</span>
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={detailHrefFor(pkg.id)}
                  className="rounded-lg border border-[#7c3aed]/35 bg-[#7c3aed]/20 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-[#ddd6fe]"
                >
                  Paket Detayına Git
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}