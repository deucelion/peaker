"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ProfileBasic } from "@/types/domain";
import type { TrainingLoadRow, WellnessReportRow } from "@/types/performance";
import { getLoadDate, processACWRData } from "@/lib/performance/loadSeries";
import {
  listPositionOptionsForManagement,
  loadAthleteDetailForManagement,
  updateAthleteProfileForManagement,
} from "@/lib/actions/athleteDetailActions";
import {
  createAthleteInjuryNote,
  deactivateAthleteInjuryNote,
  listAthleteInjuryNotesForManagement,
} from "@/lib/actions/injuryNoteActions";
import { listTeamsForActor } from "@/lib/actions/teamActions";
import { AthleteFieldTestsPanel, type FieldTestResultRow } from "./AthleteFieldTestsPanel";
import { AthletePerformanceInsightsPanel, type BodyMetricRow } from "./AthletePerformanceInsightsPanel";
import { buildAthleteRadarSpectrum } from "@/lib/fieldTests/radarSpectrum";
import { SkeletonCard, SkeletonChart, SkeletonStatGrid, SkeletonTable } from "@/components/ui/skeletons";
import { useUnsavedChangesGuard } from "@/lib/hooks/useUnsavedChangesGuard";
import { useAthletePanel } from "@/lib/hooks/useAthletePanel";
import {
  AthleteTimelineSection,
  type TimelineEvent,
} from "./_components/AthleteTimelineSection";
import { AthleteHeader } from "./_components/AthleteHeader";
import {
  AthleteCriticalStatusBar,
  type CriticalSignal,
} from "./_components/AthleteCriticalStatusBar";
import { AthleteInjurySection } from "./_components/AthleteInjurySection";
import { AthleteWellnessSection } from "./_components/AthleteWellnessSection";
import {
  AthletePerformanceHero,
  type RadarPoint,
  type WeeklyLoadPoint,
} from "./_components/AthletePerformanceHero";
import { AthleteProfileForm } from "./_components/AthleteProfileForm";
import { AthletePrivateLessonPackagesSection } from "./_components/AthletePrivateLessonPackagesSection";
import { AdminSetPasswordPanel } from "@/components/admin/AdminSetPasswordPanel";

export default function SporcuDetayDinamik() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : params.id?.[0];

  // Faz 10.1c — Sporcu paneli için temel veriler (player, wellness, training,
  // injury) `useAthletePanel` hook'una taşındı. Geri kalan presentation state
  // page'de kalır (radarData, tableMetrics, bodyMetrics, acwrStatus, weeklyLoads).
  const athletePanel = useAthletePanel();
  const loading = athletePanel.loading;
  const setLoading = athletePanel.setLoading;
  const player = athletePanel.data.player;
  const setPlayer = athletePanel.setPlayer;
  const wellnessReports = athletePanel.data.wellnessReports;
  const setWellnessReports = athletePanel.setWellnessReports;
  const trainingLoads = athletePanel.data.trainingLoads;
  const setTrainingLoads = athletePanel.setTrainingLoads;
  const [radarData, setRadarData] = useState<RadarPoint[]>([]);
  const [tableMetrics, setTableMetrics] = useState<FieldTestResultRow[]>([]);
  const [bodyMetrics, setBodyMetrics] = useState<BodyMetricRow[]>([]);
  const [acwrStatus, setAcwrStatus] = useState({ ratio: 0, label: "Veri Bekleniyor", color: "text-gray-500" });
  const [weeklyLoads, setWeeklyLoads] = useState<WeeklyLoadPoint[]>([]);
  const [positionOptions, setPositionOptions] = useState<string[]>([]);
  const [teamOptions, setTeamOptions] = useState<string[]>([]);
  const [profileDraft, setProfileDraft] = useState({
    fullName: "",
    team: "",
    position: "",
    number: "",
    height: "",
    weight: "",
  });
  const [positionMessage, setPositionMessage] = useState<string | null>(null);
  const [updatingPosition, setUpdatingPosition] = useState(false);
  const injuryNotes = athletePanel.data.injuryNotes;
  const setInjuryNotes = athletePanel.setInjuryNotes;
  const [injuryType, setInjuryType] = useState("");
  const [injuryNoteText, setInjuryNoteText] = useState("");
  const [injuryImages, setInjuryImages] = useState<File[]>([]);
  const [injurySaving, setInjurySaving] = useState(false);
  const [injuryMessage, setInjuryMessage] = useState<string | null>(null);
  const [deactivatingInjuryId, setDeactivatingInjuryId] = useState<string | null>(null);
  const [financePackage, setFinancePackage] = useState<{
    activePackageName: string | null;
    remainingLessons: number | null;
    paymentStatus: string | null;
    packageSummary: { totalLessons: number; usedLessons: number; totalPrice: number; amountPaid: number } | null;
  } | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);

  const latestWellness = useMemo(() => {
    if (!wellnessReports.length) return null;
    return [...wellnessReports].sort(
      (a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime()
    )[0];
  }, [wellnessReports]);

  const activeInjuryCount = useMemo(
    () => injuryNotes.filter((n) => n.isActive).length,
    [injuryNotes]
  );

  const localizedPaymentStatus = useMemo(() => {
    const raw = (financePackage?.paymentStatus || "").trim().toLowerCase();
    if (!raw) return "—";
    if (["paid", "odendi", "ödendi"].includes(raw)) return "Ödendi";
    if (["partial", "partially_paid", "kısmi", "kismi"].includes(raw)) return "Kısmi ödendi";
    if (["unpaid", "beklemede"].includes(raw)) return "Beklemede";
    if (["overdue", "gecikmis", "gecikmiş"].includes(raw)) return "Gecikmiş";
    return financePackage?.paymentStatus || "—";
  }, [financePackage?.paymentStatus]);

  const hasProfileDraftChanges = useMemo(() => {
    if (!player) return false;
    const normalize = (v: unknown) => String(v ?? "").trim();
    return (
      normalize(profileDraft.fullName) !== normalize(player.full_name) ||
      normalize(profileDraft.team) !== normalize(player.team) ||
      normalize(profileDraft.position) !== normalize(player.position) ||
      normalize(profileDraft.number) !== normalize(player.number) ||
      normalize(profileDraft.height) !== normalize(player.height) ||
      normalize(profileDraft.weight) !== normalize(player.weight)
    );
  }, [player, profileDraft]);

  useUnsavedChangesGuard({ enabled: hasProfileDraftChanges && !updatingPosition });

  /**
   * Faz 4 — Kritik durum chip bandı.
   * Sporcu sayfasının üst kısmında "ne önemli, ne aksiyon gerektirir"
   * sorusunu chip listesi ile cevaplar. Tüm sinyaller boşsa tek bir
   * "stabil" chip'i gösterilir.
   */

  const criticalSignals = useMemo<CriticalSignal[]>(() => {
    const signals: CriticalSignal[] = [];
    if (acwrStatus.label === "YÜKSEK RİSK") {
      signals.push({ key: "acwr-high", label: `ACWR ${acwrStatus.ratio} · Yüksek risk`, tone: "red" });
    } else if (acwrStatus.label === "YORGUN") {
      signals.push({ key: "acwr-fatigue", label: `ACWR ${acwrStatus.ratio} · Yorgun`, tone: "amber" });
    } else if (acwrStatus.label === "DÜŞÜK YÜK") {
      signals.push({ key: "acwr-low", label: `ACWR ${acwrStatus.ratio} · Düşük yük`, tone: "neutral" });
    }
    if (activeInjuryCount > 0) {
      signals.push({
        key: "injury",
        label: `Aktif sakatlık · ${activeInjuryCount}`,
        tone: "amber",
      });
    }
    const rawPaymentStatus = (financePackage?.paymentStatus || "").trim().toLowerCase();
    if (["overdue", "gecikmis", "gecikmiş"].includes(rawPaymentStatus)) {
      signals.push({ key: "payment-overdue", label: "Tahsilat vadesi geçmiş", tone: "red" });
    } else if (["unpaid", "beklemede", "partial", "partially_paid", "kısmi", "kismi"].includes(rawPaymentStatus)) {
      signals.push({ key: "payment-pending", label: "Bekleyen tahsilat tutarı", tone: "amber" });
    }
    if (financePackage?.activePackageName) {
      signals.push({
        key: "active-package",
        label: `Aktif paket · ${financePackage.remainingLessons ?? "—"} ders`,
        tone: "violet",
      });
    }
    if (trainingLoads.length === 0) {
      signals.push({ key: "no-loads", label: "Yük kaydı yok", tone: "neutral" });
    }
    if (!latestWellness) {
      signals.push({ key: "no-wellness", label: "Son wellness yok", tone: "neutral" });
    }
    if (tableMetrics.length === 0) {
      signals.push({ key: "no-fieldtest", label: "Saha testi yok", tone: "neutral" });
    }
    if (signals.length === 0) {
      signals.push({ key: "stable", label: "Belirgin kritik uyarı yok", tone: "emerald" });
    }
    return signals;
  }, [
    acwrStatus.label,
    acwrStatus.ratio,
    activeInjuryCount,
    financePackage?.activePackageName,
    financePackage?.paymentStatus,
    financePackage?.remainingLessons,
    latestWellness,
    trainingLoads.length,
    tableMetrics.length,
  ]);

  const priorityCue = useMemo((): { text: string; wrapClass: string; textClass: string } => {
    if (acwrStatus.label === "YÜKSEK RİSK") {
      return {
        text: "ACWR yüksek risk bandında. Hacmi ve dinlenmeyi birlikte değerlendirin.",
        wrapClass: "border-red-500/30 bg-red-500/10",
        textClass: "text-red-200",
      };
    }
    if (activeInjuryCount > 0) {
      return {
        text: `Aktif sakatlık kaydı: ${activeInjuryCount}. Antrenman yükü ve programı buna göre güncel tutun.`,
        wrapClass: "border-amber-500/30 bg-amber-500/10",
        textClass: "text-amber-200",
      };
    }
    if (acwrStatus.label === "YORGUN") {
      return {
        text: "Sporcu yorgunluk bandında (ACWR). Birkaç gün daha muhafazakâr ilerleyin.",
        wrapClass: "border-amber-500/25 bg-amber-500/5",
        textClass: "text-amber-200",
      };
    }
    if (trainingLoads.length === 0) {
      return {
        text: "Antrenman yükü kaydı yok. Önce düzenli yük girişi sağlayın.",
        wrapClass: "border-white/10 bg-white/[0.04]",
        textClass: "text-gray-300",
      };
    }
    if (!latestWellness) {
      return {
        text: "Son wellness raporu görünmüyor. Sabah raporu akışını kontrol edin.",
        wrapClass: "border-white/10 bg-white/[0.04]",
        textClass: "text-gray-300",
      };
    }
    return {
      text: "Belirgin kritik uyarı yok. Finans, program ve raporları rutin takip edin.",
      wrapClass: "border-emerald-500/25 bg-emerald-500/5",
      textClass: "text-emerald-200",
    };
  }, [acwrStatus.label, activeInjuryCount, latestWellness, trainingLoads.length]);

  const calculateACWR = useCallback((loads: TrainingLoadRow[]) => {
    const sorted = [...loads].sort((a, b) => getLoadDate(a).getTime() - getLoadDate(b).getTime());
    const points = processACWRData(sorted);
    const latest = points[points.length - 1];
    const ratio = latest && Number.isFinite(latest.ratio) ? latest.ratio : 0;

    let status = { ratio: parseFloat(ratio.toFixed(2)), label: "STABİL", color: "text-green-500" };
    if (ratio > 1.5) status = { ratio: parseFloat(ratio.toFixed(2)), label: "YÜKSEK RİSK", color: "text-red-500" };
    else if (ratio > 1.3) status = { ratio: parseFloat(ratio.toFixed(2)), label: "YORGUN", color: "text-yellow-500" };
    else if (ratio < 0.8 && ratio > 0) status = { ratio: parseFloat(ratio.toFixed(2)), label: "DÜŞÜK YÜK", color: "text-blue-500" };

    setAcwrStatus(status);
  }, []);

  const loadInjuryNotes = useCallback(async (athleteId: string) => {
    const notesRes = await listAthleteInjuryNotesForManagement(athleteId);
    if ("error" in notesRes) {
      setInjuryMessage(notesRes.error || "Sakatlık geçmişi alınamadı.");
      setInjuryNotes([]);
      return;
    }
    setInjuryNotes(notesRes.notes || []);
  }, [setInjuryNotes]);

  const fetchData = useCallback(async () => {
    if (!id) {
      setLoading(false);
      router.push("/oyuncular");
      return;
    }
    setLoading(true);
    try {
      const res = await loadAthleteDetailForManagement(id);
      if ("error" in res) {
        router.push("/oyuncular");
        return;
      }

      const loadedProfile = res.profile as ProfileBasic;
      setPlayer(loadedProfile);
      setProfileDraft({
        fullName: loadedProfile.full_name || "",
        team: (loadedProfile.team || "").trim(),
        position: (loadedProfile.position || "").trim(),
        number: (loadedProfile.number || "").trim(),
        height: loadedProfile.height != null ? String(loadedProfile.height) : "",
        weight: loadedProfile.weight != null ? String(loadedProfile.weight) : "",
      });

      const results = (res.results || []) as FieldTestResultRow[];
      setTableMetrics(results);
      setWellnessReports((res.wellnessReports || []) as WellnessReportRow[]);
      setBodyMetrics((res.bodyMetrics || []) as BodyMetricRow[]);
      setFinancePackage((res.financeAndPackage as never) || null);
      setTimelineEvents((res.timelineEvents || []) as TimelineEvent[]);
      setRadarData(buildAthleteRadarSpectrum(results));

      const loads = (res.loads || []) as TrainingLoadRow[];
      setTrainingLoads(loads);
      if (loads.length > 0) {
        calculateACWR(loads);
        const chartData = loads.slice(-7).map((l) => ({
          date: new Date(l.measurement_date || "").toLocaleDateString("tr-TR", { weekday: "short" }),
          yuk: l.total_load || 0,
        }));
        setWeeklyLoads(chartData);
      } else {
        setWeeklyLoads([]);
        setAcwrStatus({ ratio: 0, label: "Veri Bekleniyor", color: "text-gray-500" });
      }

      const positionsRes = await listPositionOptionsForManagement();
      if (!("error" in positionsRes)) {
        setPositionOptions(positionsRes.positions || []);
      }
      const teamsRes = await listTeamsForActor();
      if (!("error" in teamsRes)) {
        setTeamOptions((teamsRes.teams || []).map((t) => String(t.name)).filter(Boolean));
      }
      await loadInjuryNotes(id);
    } catch (e) {
      console.error("Veri hatası:", e);
      router.push("/oyuncular");
    } finally {
      setLoading(false);
    }
  }, [id, router, calculateACWR, loadInjuryNotes, setLoading, setPlayer, setTrainingLoads, setWellnessReports]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleProfileSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!id) return;
      setUpdatingPosition(true);
      setPositionMessage(null);
      const result = await updateAthleteProfileForManagement(id, {
        fullName: profileDraft.fullName,
        team: profileDraft.team,
        position: profileDraft.position,
        number: profileDraft.number,
        height: profileDraft.height,
        weight: profileDraft.weight,
      });
      if ("success" in result && result.success) {
        setPlayer((prev) =>
          prev
            ? {
                ...prev,
                full_name: profileDraft.fullName.trim(),
                team: profileDraft.team.trim() || null,
                position: profileDraft.position.trim() || null,
                number: profileDraft.number.trim() || null,
                height: profileDraft.height.trim() ? Number(profileDraft.height) : null,
                weight: profileDraft.weight.trim() ? Number(profileDraft.weight) : null,
              }
            : prev
        );
        setPositionMessage("Sporcu profili güncellendi.");
      } else {
        setPositionMessage(("error" in result && result.error) || "Sporcu profili güncellenemedi.");
      }
      setUpdatingPosition(false);
    },
    [id, profileDraft, setPlayer]
  );

  const handleProfileDraftChange = useCallback(
    (next: Partial<typeof profileDraft>) => {
      setProfileDraft((prev) => ({ ...prev, ...next }));
    },
    []
  );

  async function handleInjuryCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setInjurySaving(true);
    setInjuryMessage(null);

    const fd = new FormData();
    fd.append("athleteId", id);
    fd.append("injuryType", injuryType);
    fd.append("note", injuryNoteText);
    injuryImages.forEach((file) => fd.append("images", file));

    const result = await createAthleteInjuryNote(fd);
    if ("success" in result && result.success) {
      setInjuryType("");
      setInjuryNoteText("");
      setInjuryImages([]);
      setInjuryMessage("Sakatlık kaydı eklendi.");
      await loadInjuryNotes(id);
    } else {
      setInjuryMessage(("error" in result && result.error) || "Sakatlık kaydı eklenemedi.");
    }
    setInjurySaving(false);
  }

  async function handleInjuryDeactivate(noteId: string) {
    if (!id) return;
    setDeactivatingInjuryId(noteId);
    setInjuryMessage(null);
    const result = await deactivateAthleteInjuryNote(noteId);
    if ("success" in result && result.success) {
      setInjuryMessage("Sakatlık kaydı pasife alındı.");
      await loadInjuryNotes(id);
    } else {
      setInjuryMessage(("error" in result && result.error) || "Kayıt pasife alınamadı.");
    }
    setDeactivatingInjuryId(null);
  }

  if (loading || !player) {
    return (
      <div
        className="space-y-5 bg-black p-4 md:p-6 min-w-0 overflow-x-hidden pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
        role="status"
        aria-label="Sporcu profili yükleniyor"
      >
        <SkeletonCard rows={3} />
        <SkeletonStatGrid count={4} />
        <SkeletonChart variant="line" height={240} />
        <SkeletonTable rows={4} cols={5} />
      </div>
    );
  }

  return (
    <div className="space-y-5 md:space-y-6 pb-[max(4rem,env(safe-area-inset-bottom,0px))] text-white min-h-0 min-w-0 bg-black p-4 md:p-6 overflow-x-hidden">
      <AthleteHeader acwrStatus={acwrStatus} />

      <AthleteCriticalStatusBar
        athleteId={id}
        criticalSignals={criticalSignals}
        priorityCue={priorityCue}
        acwrStatus={acwrStatus}
        activeInjuryCount={activeInjuryCount}
        latestWellness={latestWellness}
        trainingLoadsCount={trainingLoads.length}
        financePackage={
          financePackage
            ? {
                activePackageName: financePackage.activePackageName,
                remainingLessons: financePackage.remainingLessons,
              }
            : null
        }
        localizedPaymentStatus={localizedPaymentStatus}
      />

      <AthleteProfileForm
        player={player}
        profileDraft={profileDraft}
        positionOptions={positionOptions}
        teamOptions={teamOptions}
        updatingPosition={updatingPosition}
        positionMessage={positionMessage}
        onDraftChange={handleProfileDraftChange}
        onSubmit={handleProfileSubmit}
      />

      {id ? (
        <AdminSetPasswordPanel
          targetUserId={id}
          targetName={player.full_name || "Sporcu"}
          targetRoleLabel="Sporcu"
        />
      ) : null}

      {id && player ? (
        <AthletePrivateLessonPackagesSection athleteId={id} athleteName={player.full_name || "Sporcu"} />
      ) : null}

      <div className="grid min-w-0 gap-5 md:gap-6 lg:grid-cols-2 lg:items-start">
        <AthleteInjurySection
          injuryNotes={injuryNotes}
          injuryMessage={injuryMessage}
          injuryType={injuryType}
          injuryNoteText={injuryNoteText}
          injurySaving={injurySaving}
          deactivatingInjuryId={deactivatingInjuryId}
          onInjuryTypeChange={setInjuryType}
          onInjuryNoteChange={setInjuryNoteText}
          onInjuryImagesChange={setInjuryImages}
          onCreate={handleInjuryCreate}
          onDeactivate={handleInjuryDeactivate}
        />
        <AthleteWellnessSection latestWellness={latestWellness} />
      </div>

      <AthletePerformanceHero radarData={radarData} weeklyLoads={weeklyLoads} />

      <AthleteTimelineSection
        events={timelineEvents}
        emptyFinanceHref={id ? `/finans/${id}` : "/finans"}
      />

      <AthletePerformanceInsightsPanel
        athleteName={player?.full_name || "Sporcu"}
        loads={trainingLoads}
        wellnessReports={wellnessReports}
        bodyMetrics={bodyMetrics}
      />

      <AthleteFieldTestsPanel
        results={tableMetrics}
        athleteId={id || ""}
        athleteName={player?.full_name || "Sporcu"}
        heightCm={player?.height ?? null}
        weightKg={player?.weight ?? null}
      />
    </div>
  );
}

