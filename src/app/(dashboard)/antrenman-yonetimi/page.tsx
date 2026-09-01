"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
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
} from "lucide-react";
import { listAttendanceSnapshot, listTrainingParticipantsSnapshot } from "@/lib/actions/snapshotActions";
import type { TrainingParticipantRow, TrainingScheduleRow } from "@/types/domain";
import Notification from "@/components/Notification";
import EmptyState from "@/components/ui/EmptyState";
import { setAttendanceStatus } from "@/lib/actions/attendanceActions";
import { fetchMeRoleClient } from "@/lib/auth/meRoleClient";
import { useMeAccessOrganizationFeatures } from "@/lib/auth/useMeAccess";
import type { OrganizationFeatures } from "@/lib/organization/features/types";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import { attendanceDraftKey } from "@/lib/offline/draftKeys";
import {
  enqueueAttendanceChange,
  persistAttendanceDraft,
  type AttendanceDraftPayload,
} from "@/lib/offline/attendanceOffline";
import { buildOfflineScopeKey } from "@/lib/offline/scope";
import { OverlayMenu, OVERLAY_Z, overlayZIndex } from "@/components/ui/overlay";
import { UiTabsNav } from "@/components/ui/navigation/UiTabsNav";
import { clearScopedFormDraft, loadScopedFormDraft } from "@/lib/offline/scopedFormDrafts";
import { DEFAULT_COACH_PERMISSIONS } from "@/lib/types";
import LoadingState from "@/components/ui/data-display/LoadingState";

function ModuleLoadingPanel() {
  return <LoadingState label="Modül yükleniyor..." />;
}

const WeeklyLessonSchedulePage = dynamic(() => import("../haftalik-ders-programi/page"), {
  loading: () => <ModuleLoadingPanel />,
});
const LessonsPage = dynamic(() => import("../dersler/page"), {
  loading: () => <ModuleLoadingPanel />,
});
const ProgramNotesPage = dynamic(() => import("../notlar-haftalik-program/page"), {
  loading: () => <ModuleLoadingPanel />,
});
import {
  VALID_TRAINING_VIEWS,
  formatTrainingDateTr,
  formatTrainingTimeShort,
  normalizedAttendanceStatus,
  notificationVariantFromMessage,
  toAttendanceBadgeLabel,
  type TrainingWorkspaceView,
} from "./_utils/training";
import { GroupLessonsView } from "./_components/GroupLessonsView";
import { PrivateLessonsView } from "./_components/PrivateLessonsView";

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
  const [loading, setLoading] = useState(false);
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
  const online = useOnlineStatus();
  const [scopeKey, setScopeKey] = useState("");
  const organizationFeatures = useMeAccessOrganizationFeatures();
  const [actorUserId, setActorUserId] = useState("");
  const [hasAttendanceDraft, setHasAttendanceDraft] = useState(false);

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

  const needsAttendanceBootstrap = useMemo(() => {
    if (moduleView === "haftalik-takvim" || moduleView === "ozel-dersler" || moduleView === "notlar") {
      return false;
    }
    if (moduleView === "grup-dersleri") {
      return activeWorkspaceView !== "ders-listesi" && activeWorkspaceView !== "ders-olustur";
    }
    return false;
  }, [moduleView, activeWorkspaceView]);

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

  const applyAttendanceStatuses = useCallback(
    (
      rows: TrainingParticipantRow[],
      statuses: Record<string, "registered" | "attended" | "missed" | "cancelled">
    ) =>
      rows.map((row) => {
        const status = statuses[row.profile_id];
        if (!status) return row;
        return {
          ...row,
          attendance_status: status,
          is_present: status === "attended" ? true : status === "missed" ? false : null,
        };
      }),
    []
  );

  const loadParticipants = useCallback(
    async (tId: string) => {
      const snapshot = await listTrainingParticipantsSnapshot(tId, 1, 300);
      if ("error" in snapshot) {
        setActionMessage(snapshot.error || "Katılımcı verisi alınamadı.");
        setParticipants([]);
        return;
      }
      const data = (snapshot.participants || []) as unknown as TrainingParticipantRow[];
      if (data) {
        let normalized = data.map((row) => ({
          ...row,
          attendance_status:
            row.attendance_status ||
            (row.is_present === true ? "attended" : row.is_present === false ? "missed" : "registered"),
        })) as TrainingParticipantRow[];

        if (scopeKey && actorUserId) {
          const draft = loadScopedFormDraft(scopeKey, attendanceDraftKey(tId, actorUserId));
          const payload = draft?.payload as AttendanceDraftPayload | undefined;
          if (payload?.trainingId === tId && payload.statuses) {
            normalized = applyAttendanceStatuses(normalized, payload.statuses);
            setHasAttendanceDraft(true);
          }
        }
        setParticipants(normalized);
      } else setParticipants([]);
    },
    [scopeKey, actorUserId, applyAttendanceStatuses]
  );

  const loadInitialData = useCallback(async () => {
    if (!needsAttendanceBootstrap) {
      setLoading(false);
      return;
    }

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

    const me = await fetchMeRoleClient();
    if (me.ok) {
      setActorUserId(me.userId);
      setScopeKey(buildOfflineScopeKey(me.organizationId, me.userId));
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
  }, [needsAttendanceBootstrap, requestedTrainingId, loadParticipants]);

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

  function saveAttendanceDraftLocal(
    trainingId: string,
    nextParticipants: TrainingParticipantRow[]
  ) {
    if (!scopeKey || !actorUserId) return;
    const statuses = nextParticipants.reduce<
      Record<string, "registered" | "attended" | "missed" | "cancelled">
    >((acc, p) => {
      acc[p.profile_id] = normalizedAttendanceStatus(p);
      return acc;
    }, {});
    persistAttendanceDraft(scopeKey, attendanceDraftKey(trainingId, actorUserId), {
      trainingId,
      lessonTitle: selectedTraining?.title,
      statuses,
      updatedAt: new Date().toISOString(),
    });
    setHasAttendanceDraft(true);
  }

  async function updateAttendance(
    profileId: string,
    status: "registered" | "attended" | "missed" | "cancelled"
  ) {
    if (!selectedTrainingId) return;
    const participant = participants.find((p) => p.profile_id === profileId);
    const profileName = participant?.profiles?.full_name;

    setRowSavingIds((prev) => [...prev, profileId]);
    const nextParticipants = participants.map((p) =>
      p.profile_id === profileId
        ? {
            ...p,
            attendance_status: status,
            is_present: status === "attended" ? true : status === "missed" ? false : null,
          }
        : p
    );
    setParticipants(nextParticipants);
    saveAttendanceDraftLocal(selectedTrainingId, nextParticipants);

    if (!online) {
      if (!scopeKey) {
        setActionMessage("Çevrimdışı yoklama için oturum doğrulanamadı.");
        setRowSavingIds((prev) => prev.filter((id) => id !== profileId));
        return;
      }
      const queued = enqueueAttendanceChange({
        scopeKey,
        trainingId: selectedTrainingId,
        profileId,
        profileName,
        status,
        lessonTitle: selectedTraining?.title,
        organizationFeatures,
      });
      if ("error" in queued) setActionMessage(queued.error);
      else setActionMessage("Yoklama kuyruğa alındı. Bağlantı gelince senkronize edilir.");
      setRowSavingIds((prev) => prev.filter((id) => id !== profileId));
      return;
    }

    const result = await setAttendanceStatus(selectedTrainingId, profileId, status);
    if (result?.success) {
      if (scopeKey && actorUserId) {
        clearScopedFormDraft(scopeKey, attendanceDraftKey(selectedTrainingId, actorUserId));
        setHasAttendanceDraft(false);
      }
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

    const nextParticipants = participants.map((p) =>
      targetIds.includes(p.profile_id)
        ? {
            ...p,
            attendance_status: status,
            is_present: status === "attended" ? true : status === "missed" ? false : null,
          }
        : p
    );
    setParticipants(nextParticipants);
    saveAttendanceDraftLocal(selectedTrainingId, nextParticipants);

    if (!online) {
      if (!scopeKey) {
        setActionMessage("Çevrimdışı toplu yoklama için oturum doğrulanamadı.");
        setBulkSaving(false);
        return;
      }
      let errors = 0;
      for (const profileId of targetIds) {
        const p = participants.find((x) => x.profile_id === profileId);
        const queued = enqueueAttendanceChange({
          scopeKey,
          trainingId: selectedTrainingId,
          profileId,
          profileName: p?.profiles?.full_name,
          status,
          lessonTitle: selectedTraining?.title,
          organizationFeatures,
        });
        if ("error" in queued) errors += 1;
      }
      setSelectedIds([]);
      setActionMessage(
        errors > 0
          ? `${errors} kayıt kuyruğa alınamadı; diğerleri bekliyor.`
          : "Toplu yoklama kuyruğa alındı. Bağlantı gelince senkronize edilir."
      );
      setBulkSaving(false);
      return;
    }

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
      if (scopeKey && actorUserId) {
        clearScopedFormDraft(scopeKey, attendanceDraftKey(selectedTrainingId, actorUserId));
        setHasAttendanceDraft(false);
      }
    }
    setBulkSaving(false);
  }

  function renderWorkspaceContent() {
    if (moduleView === "ozel-dersler") {
      return (
        <PrivateLessonsView
          view={activeWorkspaceView}
          packageId={requestedPackageId}
        />
      );
    }
    if (moduleView === "notlar") return <ProgramNotesPage />;
    if (moduleView === "haftalik-takvim") return <WeeklyLessonSchedulePage />;
    if (activeWorkspaceView === "ders-listesi") {
      return (
        <GroupLessonsView
          lessonId={requestedLessonId}
          onOpenLesson={openGroupLessonDetail}
          onBackToList={closeGroupLessonDetail}
        />
      );
    }
    if (activeWorkspaceView === "ders-olustur") return <LessonsPage />;
    if (activeWorkspaceView === "notlar") return <ProgramNotesPage />;

    return trainings.length === 0 ? (
      <EmptyState
        variant="no_data"
        bare
        compact
        className="rounded-[1.75rem] ui-card px-6 py-16 sm:rounded-[2rem]"
        title="Gösterilecek ders yok"
        description="Yaklaşan antrenman oluşturulduğunda buradan kadroyu görüp yoklama alabilirsiniz."
      />
    ) : (
      <div className="min-w-0 space-y-5 sm:space-y-6">
        <div className="min-h-[min(420px,65vh)] min-w-0 rounded-[1.75rem] ui-card p-5 shadow-xl sm:rounded-[2.5rem] sm:p-8 lg:min-h-[520px]">
          <div className="mb-6 flex min-w-0 flex-col gap-6 border-b pb-6 sm:mb-8 sm:flex-row sm:items-start sm:justify-between sm:pb-8">
            <div className="flex min-w-0 flex-1 items-start gap-4 sm:gap-5">
              <div className="shrink-0 rounded-[1.25rem] ui-btn-primary p-3 text-white shadow-xl shadow-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_40%,transparent)] sm:rounded-[1.5rem] sm:p-4">
                <Activity size={24} aria-hidden />
              </div>
              <div className="relative min-w-0 flex-1 space-y-3" ref={lessonMenuRef}>
                <p id="lesson-select-label" className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Ders seçimi</p>
                <button
                  type="button"
                  onClick={() => setLessonMenuOpen((o) => !o)}
                  className="flex w-full min-w-0 items-start justify-between gap-3 rounded-2xl ui-card-inner px-4 py-3.5 text-left transition hover:border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_40%,transparent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_50%,transparent)]"
                  aria-expanded={lessonMenuOpen}
                  aria-haspopup="listbox"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-black text-white sm:text-lg">{selectedTraining?.title ?? "Ders seçin"}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3.5 shrink-0 text-[color:var(--peaker-ui-PRIMARY)]" aria-hidden />
                        {selectedTraining ? formatTrainingDateTr(selectedTraining.start_time) : "—"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5 shrink-0 text-[color:var(--peaker-ui-PRIMARY)]" aria-hidden />
                        {formatTrainingTimeShort(selectedTraining?.start_time)}
                        {selectedTraining?.end_time ? `–${formatTrainingTimeShort(selectedTraining.end_time)}` : ""}
                      </span>
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <MapPin className="size-3.5 shrink-0 text-[color:var(--peaker-ui-PRIMARY)]" aria-hidden />
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
                    className="absolute left-0 right-0 mt-2 max-h-[min(60vh,400px)]"
                    style={{ zIndex: overlayZIndex(OVERLAY_Z.BACKDROP) }}
                  >
                    <OverlayMenu
                      labelledBy="lesson-select-label"
                      className="max-h-[min(60vh,400px)] overflow-y-auto py-1 shadow-2xl shadow-black/60"
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
                            className={`flex w-full min-w-0 flex-col gap-0.5 border-b px-4 py-3 text-left last:border-0 touch-manipulation ${ active ? "ui-kpi-chip--brand" : "hover:ui-kpi-band" }`}
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
                    </OverlayMenu>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="shrink-0 rounded-2xl ui-kpi-band px-5 py-3 text-center sm:px-6 sm:py-4">
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
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl ui-kpi-band px-3 py-2.5 sm:gap-x-4">
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
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full ui-kpi-band">
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
                className="ui-input min-h-11 w-full min-w-0 px-3 text-base sm:text-sm"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "registered" | "attended" | "missed" | "cancelled")}
                className="ui-select min-h-11 w-full min-w-0 px-3 sm:max-lg:col-span-2 lg:col-span-1"
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
                  <Loader2 className="size-4 animate-spin text-[color:var(--peaker-ui-PRIMARY)]" aria-hidden />
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
                className="min-h-11 w-full touch-manipulation rounded-xl px-3 text-[11px] font-bold uppercase text-gray-300 disabled:opacity-40 sm:w-auto"
              >
                Kayıtlı · görünenler
              </button>
            </div>
          </div>

          {!online ? (
            <div className="mb-3">
              <Notification
                message="Çevrimdışısınız; yoklama seçimleri cihazınızda saklanır ve bağlantı gelince senkronize edilir."
                variant="info"
              />
            </div>
          ) : null}
          {hasAttendanceDraft ? (
            <div className="mb-3">
              <Notification message="Kaydedilmemiş yoklama taslağı geri yüklendi." variant="info" />
            </div>
          ) : null}
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">Sporcu yoklaması</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {filteredParticipants.length > 0 ? (
              filteredParticipants.map((p) => {
                const st = normalizedAttendanceStatus(p);
                return (
                  <div
                    key={`${p.training_id}-${p.profile_id}`}
                    className="group flex min-w-0 flex-col gap-3 rounded-2xl ui-card-inner p-4 transition-all sm:flex-row sm:items-stretch sm:justify-between sm:gap-4 sm:p-4 sm:hover:border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_20%,transparent)]"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(p.profile_id)}
                        onChange={(e) =>
                          setSelectedIds((prev) => (e.target.checked ? [...prev, p.profile_id] : prev.filter((id) => id !== p.profile_id)))
                        }
                        className="mt-2.5 size-4 shrink-0 accent-[color:var(--peaker-ui-PRIMARY)] touch-manipulation"
                        aria-label={`${p.profiles.full_name ?? "Sporcu"} seç`}
                      />
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl ui-card text-base font-black italic text-[color:var(--peaker-ui-PRIMARY)] sm:size-12 sm:text-lg">
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

                    <div className="flex min-w-0 flex-col gap-2 border-t pt-3 sm:w-[min(100%,260px)] sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase ${ st === "attended" ? "border-green-500/25 bg-green-500/10 text-green-400" : st === "missed" ? "border-red-500/25 bg-red-500/10 text-red-400" : st === "cancelled" ? "text-gray-300" : "border-amber-500/25 bg-amber-500/10 text-amber-300" }`}
                        >
                          {toAttendanceBadgeLabel(st)}
                        </span>
                        {rowSavingIds.includes(p.profile_id) ? <Loader2 className="size-4 shrink-0 animate-spin text-[color:var(--peaker-ui-PRIMARY)]" aria-hidden /> : null}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        <button
                          type="button"
                          onClick={() => void updateAttendance(p.profile_id, "attended")}
                          disabled={(actorRole === "coach" && !permissions.can_take_attendance) || rowSavingIds.includes(p.profile_id)}
                          className={`flex min-h-10 touch-manipulation items-center justify-center rounded-lg text-[9px] font-black uppercase transition-all ${ st === "attended" ? "bg-green-500 text-white shadow-md shadow-green-500/20" : "text-gray-400 sm:hover:border-green-500/35 sm:hover:text-green-400" }`}
                          title="Katıldı"
                        >
                          <Check size={16} className="shrink-0 sm:mr-0.5" aria-hidden />
                          <span className="sr-only sm:not-sr-only sm:inline">Katıldı</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateAttendance(p.profile_id, "missed")}
                          disabled={(actorRole === "coach" && !permissions.can_take_attendance) || rowSavingIds.includes(p.profile_id)}
                          className={`flex min-h-10 touch-manipulation items-center justify-center rounded-lg text-[9px] font-black uppercase transition-all ${ st === "missed" ? "bg-red-500 text-white shadow-md shadow-red-500/20" : "text-gray-400 sm:hover:border-red-500/35 sm:hover:text-red-400" }`}
                          title="Gelmedi"
                        >
                          <X size={16} className="shrink-0 sm:mr-0.5" aria-hidden />
                          <span className="sr-only sm:not-sr-only sm:inline">Gelmedi</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateAttendance(p.profile_id, "registered")}
                          disabled={(actorRole === "coach" && !permissions.can_take_attendance) || rowSavingIds.includes(p.profile_id)}
                          className={`min-h-10 touch-manipulation rounded-lg px-1 text-[9px] font-black uppercase transition-all ${ st === "registered" ? "bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/35" : "text-gray-500 sm:hover:text-amber-300" }`}
                          title="Henüz işaretlenmedi"
                        >
                          Kayıtlı
                        </button>
                        <button
                          type="button"
                          onClick={() => void updateAttendance(p.profile_id, "cancelled")}
                          disabled={(actorRole === "coach" && !permissions.can_take_attendance) || rowSavingIds.includes(p.profile_id)}
                          className={`min-h-10 touch-manipulation rounded-lg px-1 text-[9px] font-black uppercase transition-all ${ st === "cancelled" ? "ui-badge-neutral text-gray-200 ring-1 ring-[color:color-mix(in_srgb,var(--peaker-ui-TEXT_SECONDARY,#6b7280)_20%,transparent)]" : "text-gray-500 sm:hover:text-gray-300" }`}
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
              <EmptyState
                variant="filtered_empty"
                bare
                compact
                className="col-span-full rounded-2xl ui-card-inner px-4 py-16"
                title="Bu filtreyle eşleşen sporcu yok"
                description="Arama metnini veya durum filtresini sıfırlayın; kadronun tamamı için &quot;Tüm durumlar&quot;ı seçin."
                primaryAction={{
                  label: "Filtreleri sıfırla",
                  onClick: () => {
                    setSearch("");
                    setStatusFilter("all");
                  },
                }}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loading)
    return (
      <div className="flex min-h-[45dvh] min-w-0 flex-col items-center justify-center gap-4 overflow-x-hidden px-4 py-10 pb-[max(1rem,env(safe-area-inset-bottom,0px))] text-center text-sm font-black uppercase italic tracking-wide text-white animate-pulse sm:tracking-widest">
        <Loader2 className="h-10 w-10 animate-spin text-[color:var(--peaker-ui-PRIMARY)]" aria-hidden />
        <span>Operasyon Merkezi Hazırlanıyor...</span>
      </div>
    );

  return (
    <div className="ui-page space-y-6 sm:space-y-8 pb-[max(4rem,env(safe-area-inset-bottom,0px))] min-w-0 overflow-x-hidden">
      <header className="min-w-0 space-y-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">Ders merkezi</p>
          <h1 className="text-2xl font-black uppercase italic tracking-tighter text-white break-words sm:text-3xl">
            Ders <span className="text-[color:var(--peaker-ui-PRIMARY)]">Yönetimi</span>
          </h1>
          <p className="mt-2 border-l-2 border-[color:var(--peaker-ui-PRIMARY)] pl-3 text-sm font-medium text-gray-500 sm:pl-4 sm:text-base">
            Haftalık takvim, grup dersleri ve özel ders operasyonunu tek merkezden yönetin.
          </p>
        </div>
        <div className="space-y-2">
          <UiTabsNav
            ariaLabel="Ders yönetimi modülleri"
            tabs={moduleTabs.map((tab) => ({
              key: tab.key,
              label: tab.label,
              href: tab.href,
              active: moduleView === tab.key,
            }))}
          />
          <UiTabsNav
            ariaLabel="Modül alt görünümleri"
            tabs={moduleContextTabs.map((tab) => ({
              key: tab.key,
              label: tab.label,
              onClick: () => updateWorkspaceView(tab.key as TrainingWorkspaceView),
              active: activeWorkspaceView === tab.key,
            }))}
          />
        </div>
        <div className="rounded-xl ui-card-inner px-3 py-2 text-[10px] font-semibold text-gray-400">
          Aktif bağlam:{" "}
          <span className="font-black ui-kpi-card__trend">
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

