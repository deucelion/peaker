"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Users, Calendar, CreditCard, AlertCircle, BarChart3, Target, Loader2, UserPlus2 } from "lucide-react";
import Link from "next/link";
import { PATHS } from "@/lib/navigation/routeRegistry";
import { useRouter } from "next/navigation";
import { addCoach } from "@/lib/actions/coachActions";
import { bootstrapTenantHomeDashboard } from "@/lib/actions/snapshotActions";
import {
  updateOrganizationDisplayNameAction,
  updateOrganizationTimeZoneAction,
} from "@/lib/actions/organizationProfileActions";
import { listSupportedTimeZones } from "@/lib/organization/timeZoneOptions";
import { DEFAULT_COACH_PERMISSIONS } from "@/lib/types";
import type { CoachPermissions } from "@/lib/types";
import type { PrivateLessonSessionListItem } from "@/lib/types";
import { listUpcomingPrivateLessonSessionsForCoach } from "@/lib/actions/privateLessonSessionActions";
import { useMeAccessOrganizationFeatures } from "@/lib/auth/useMeAccess";
import { DASHBOARD_WIDGET_IDS } from "@/lib/organization/features/surfaces/widgetEntitlementMap";
import type { OrganizationFeatures } from "@/lib/organization/features/types";
import {
  shouldRenderDashboardWidget,
  type DashboardWidgetVisibilityContext,
} from "@/lib/navigation/widgetFeatureVisibility";
import { formatLessonDateTimeTr } from "@/lib/forms/datetimeLocal";
import { toDisplayName } from "@/lib/profile/displayName";
import { normalizeEmailInput } from "@/lib/email/emailNormalize";
import { PASSWORD_FIELD_PROPS } from "@/lib/auth/passwordInput";
import EmptyState from "@/components/ui/EmptyState";
import OnboardingChecklist, {
  type OnboardingProgress,
} from "@/components/onboarding/OnboardingChecklist";
import { LiveStatusBadge } from "@/components/realtime/LiveStatusPrimitives";
import { CoachMobileQuickStrip } from "@/components/mobile/CoachMobileQuickStrip";
import { PerformanceOrgSummaryBand } from "@/components/performance/PerformanceOrgSummaryBand";
import { CompactListRow, CompactMetricCard } from "@/components/compact";
import { useLiveAttendanceDashboard } from "@/lib/hooks/useLiveAttendanceDashboard";
import { useOrgPresenceCounts } from "@/lib/hooks/useOrgPresenceCounts";

// --- TYPESCRIPT INTERFACES ---
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend: string;
  color: string;
  action?: string;
}

interface TeamPaymentRow {
  name: string;
  completionRate: number;
  paymentStatus: string;
  warning: boolean;
}

interface RecentTraining {
  id: string;
  title: string;
  start_time: string;
  location: string | null;
}

interface CoachListItem {
  id: string;
  full_name: string;
  email: string | null;
  created_at?: string | null;
}

interface AdminLessonRow {
  id: string;
  title: string;
  start_time: string;
  location: string | null;
  capacity: number | null;
  coach_id: string | null;
  coach_profile?: { full_name?: string | null } | { full_name?: string | null }[] | null;
  training_participants?: Array<{ attendance_status?: string | null }>;
}

interface RecentProgramRow {
  id: string;
  title: string | null;
  created_at: string;
  coach_profile?: { full_name?: string | null } | { full_name?: string | null }[] | null;
  athlete_profile?: { full_name?: string | null } | { full_name?: string | null }[] | null;
}

interface CoachLessonRow {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  capacity: number | null;
  training_participants?: Array<{ attendance_status?: string | null }>;
}

interface CoachProgramRow {
  id: string;
  title: string | null;
  created_at: string;
  is_active: boolean | null;
  athlete_profile?: { full_name?: string | null } | { full_name?: string | null }[] | null;
}

interface CoachNotificationRow {
  id: string;
  message: string;
  read: boolean;
  created_at: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalPlayers: 0,
    activeTrainings: 0,
    attendanceRate: "-",
    monthlyRevenue: "-",
  });
  const [recentActivities, setRecentActivities] = useState<RecentTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState("PEAKER LAB");
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [orgNameSaving, setOrgNameSaving] = useState(false);
  const [orgNameHint, setOrgNameHint] = useState<string | null>(null);
  const [orgTimeZone, setOrgTimeZone] = useState<string>("Europe/Istanbul");
  const [orgTimeZoneSaving, setOrgTimeZoneSaving] = useState(false);
  const [orgTimeZoneHint, setOrgTimeZoneHint] = useState<string | null>(null);
  const [role, setRole] = useState<"super_admin" | "admin" | "coach" | "sporcu">("sporcu");
  const [coaches, setCoaches] = useState<CoachListItem[]>([]);
  const [teamPaymentRows, setTeamPaymentRows] = useState<TeamPaymentRow[]>([]);
  const [coachForm, setCoachForm] = useState({ fullName: "", email: "", password: "" });
  const [coachSubmitting, setCoachSubmitting] = useState(false);
  const [coachFeedback, setCoachFeedback] = useState<string | null>(null);
  const [attendanceTarget, setAttendanceTarget] = useState<number | null>(null);
  const [revenueTrend, setRevenueTrend] = useState("VERI YOK");
  const [coachPermissions, setCoachPermissions] = useState<CoachPermissions | null>(null);
  const [todayLessons, setTodayLessons] = useState<CoachLessonRow[]>([]);
  const [pendingAttendanceLessons, setPendingAttendanceLessons] = useState<CoachLessonRow[]>([]);
  const [upcomingLessons, setUpcomingLessons] = useState<CoachLessonRow[]>([]);
  const [recentPrograms, setRecentPrograms] = useState<CoachProgramRow[]>([]);
  const [notificationPreview, setNotificationPreview] = useState<CoachNotificationRow[]>([]);
  const [adminTodayLessons, setAdminTodayLessons] = useState<AdminLessonRow[]>([]);
  const [adminPendingAttendance, setAdminPendingAttendance] = useState<AdminLessonRow[]>([]);
  const [adminRecentPrograms, setAdminRecentPrograms] = useState<RecentProgramRow[]>([]);
  const [adminRecentAttendanceUpdates, setAdminRecentAttendanceUpdates] = useState<
    Array<{ training_id: string; marked_at: string | null; athlete_name: string }>
  >([]);
  const [activeCoachCountToday, setActiveCoachCountToday] = useState(0);
  /** Son 7 gün ders sayısı, 30 gün yoklama oranı (işaretlenen), katılımcı sporcu sayısı */
  const [coachOpsMetrics, setCoachOpsMetrics] = useState<{
    lessons7d: number;
    attendanceRate: string;
    activeAthletes: number;
  } | null>(null);
  const [coachPrivateSessions, setCoachPrivateSessions] = useState<PrivateLessonSessionListItem[]>([]);
  const [onboardingProgress, setOnboardingProgress] = useState<OnboardingProgress | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fetchRunRef = useRef(0);
  const organizationFeatures = useMeAccessOrganizationFeatures();
  const router = useRouter();

  const fetchDashboardData = useCallback(async (opts?: { soft?: boolean; retried?: boolean }) => {
    const runId = ++fetchRunRef.current;
    const soft = Boolean(opts?.soft);
    if (!soft) setLoading(true);
    try {
      let boot = await bootstrapTenantHomeDashboard();
      if (runId !== fetchRunRef.current) return;
      const sessionRetryErrors = new Set(["Gecersiz oturum.", "Organizasyon bilgisi yuklenemedi. Lutfen tekrar deneyin."]);
      const bootLoadError = "loadError" in boot ? boot.loadError : null;
      const snapshotError =
        "snapshot" in boot &&
        boot.snapshot &&
        typeof boot.snapshot === "object" &&
        "error" in boot.snapshot &&
        typeof boot.snapshot.error === "string"
          ? boot.snapshot.error
          : null;
      if (
        !opts?.retried &&
        ((bootLoadError && sessionRetryErrors.has(bootLoadError)) ||
          (snapshotError && sessionRetryErrors.has(snapshotError)))
      ) {
        await new Promise((r) => setTimeout(r, 120));
        boot = await bootstrapTenantHomeDashboard();
        if (runId !== fetchRunRef.current) return;
      }

      if ("redirectTo" in boot) {
        router.replace(boot.redirectTo);
        return;
      }
      if ("loadError" in boot) {
        if (runId !== fetchRunRef.current) return;
        setLoadError(boot.loadError);
        return;
      }
      const snapshot = boot.snapshot;
      if ("error" in snapshot) {
        if (runId !== fetchRunRef.current) return;
        setLoadError(snapshot.error ?? "Panel verileri yuklenemedi.");
        return;
      }
      if (runId !== fetchRunRef.current) return;
      setLoadError(null);
      setRole((snapshot.role || "sporcu") as "super_admin" | "admin" | "coach" | "sporcu");
      setOrgName(snapshot.orgName || "PEAKER LAB");
      setCurrentOrgId(snapshot.organizationId || null);
      if ("orgTimeZone" in snapshot && typeof snapshot.orgTimeZone === "string" && snapshot.orgTimeZone) {
        setOrgTimeZone(snapshot.orgTimeZone);
      }

      if (snapshot.role === "coach" && snapshot.coach) {
        setCoachPermissions(snapshot.coach.permissions || DEFAULT_COACH_PERMISSIONS);
        setTodayLessons((snapshot.coach.todayLessons || []) as CoachLessonRow[]);
        setUpcomingLessons((snapshot.coach.upcomingLessons || []) as CoachLessonRow[]);
        setPendingAttendanceLessons((snapshot.coach.pendingAttendanceLessons || []) as CoachLessonRow[]);
        setNotificationPreview((snapshot.coach.notificationPreview || []) as CoachNotificationRow[]);
        setRecentPrograms((snapshot.coach.recentPrograms || []) as CoachProgramRow[]);
        setCoachOpsMetrics(snapshot.coach.opsMetrics || null);
        setStats((prev) => ({ ...prev, activeTrainings: snapshot.coach?.activeTrainings || 0 }));
        const perms = snapshot.coach.permissions || DEFAULT_COACH_PERMISSIONS;
        if (perms.can_manage_training_notes) {
          const ps = await listUpcomingPrivateLessonSessionsForCoach(6);
          setCoachPrivateSessions("sessions" in ps ? ps.sessions : []);
        } else {
          setCoachPrivateSessions([]);
        }
        setLoading(false);
        return;
      }

      if (snapshot.role === "admin" && snapshot.admin) {
        setCoachPermissions(null);
        setStats({
          totalPlayers: snapshot.admin.stats?.totalPlayers ?? 0,
          activeTrainings: snapshot.admin.stats?.activeTrainings ?? 0,
          attendanceRate: snapshot.admin.stats?.attendanceRate ?? "-",
          monthlyRevenue: snapshot.admin.stats?.monthlyRevenue ?? "-",
        });
        const onboardingMetrics =
          (snapshot.admin as { onboarding?: { totalAthletes?: number; totalTeams?: number; totalLessons?: number; totalFieldTestMetrics?: number; totalPayments?: number } }).onboarding ??
          null;
        if (onboardingMetrics) {
          setOnboardingProgress({
            organizationId: snapshot.organizationId || null,
            hasCustomOrgName: Boolean(snapshot.orgName) && snapshot.orgName !== "PEAKER LAB",
            totalAthletes: onboardingMetrics.totalAthletes || 0,
            totalTeams: onboardingMetrics.totalTeams || 0,
            totalLessons: onboardingMetrics.totalLessons || 0,
            totalFieldTestMetrics: onboardingMetrics.totalFieldTestMetrics || 0,
            totalPayments: onboardingMetrics.totalPayments || 0,
          });
        } else {
          setOnboardingProgress(null);
        }
        const attendanceNumeric = Number(snapshot.admin.stats?.attendanceRate ?? "-");
        if (!Number.isNaN(attendanceNumeric) && attendanceNumeric > 0) {
          setAttendanceTarget(Math.max(75, Math.min(98, Math.round(attendanceNumeric + 5))));
        } else {
          setAttendanceTarget(null);
        }
        setRevenueTrend(snapshot.admin.revenueTrend || "VERI YOK");
        setRecentActivities((snapshot.admin.recentActivities || []) as RecentTraining[]);
        setCoaches((snapshot.admin.coaches || []) as CoachListItem[]);
        setTeamPaymentRows((snapshot.admin.teamStats || []) as TeamPaymentRow[]);
        setAdminTodayLessons((snapshot.admin.adminTodayLessons || []) as AdminLessonRow[]);
        setAdminPendingAttendance((snapshot.admin.adminPendingAttendance || []) as AdminLessonRow[]);
        setActiveCoachCountToday(snapshot.admin.activeCoachCountToday || 0);
        setAdminRecentPrograms((snapshot.admin.adminRecentPrograms || []) as RecentProgramRow[]);
        setAdminRecentAttendanceUpdates(snapshot.admin.adminRecentAttendanceUpdates || []);
      }
    } catch (err) {
      console.error("Dashboard Load Error:", err);
      if (runId !== fetchRunRef.current) return;
      setLoadError("Panel verileri yuklenemedi. Lutfen tekrar deneyin.");
    } finally {
      if (!soft && runId === fetchRunRef.current) setLoading(false);
    }
  }, [router]);

  const softRefreshDashboard = useCallback(() => {
    void fetchDashboardData({ soft: true });
  }, [fetchDashboardData]);

  useLiveAttendanceDashboard({
    enabled: !loading && (role === "admin" || role === "coach"),
    organizationFeatures,
    onSoftRefresh: softRefreshDashboard,
  });

  const presenceCounts = useOrgPresenceCounts(
    !loading && role === "admin" ? currentOrgId : null,
    !loading && role === "admin" ? "admin" : null,
    organizationFeatures
  );

  useOrgPresenceCounts(
    !loading && role === "coach" ? currentOrgId : null,
    !loading && role === "coach" ? "coach" : null,
    organizationFeatures
  );

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  const handleCoachCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCoachSubmitting(true);
    setCoachFeedback(null);

    const fd = new FormData();
    fd.append("fullName", coachForm.fullName);
    fd.append("email", normalizeEmailInput(coachForm.email));
    fd.append("password", coachForm.password);

    const result = await addCoach(fd);
    if (result && "success" in result && result.success) {
      const note =
        "alreadyExisted" in result && result.alreadyExisted
          ? " (zaten kayitli koc; liste senkron)"
          : "repairedOrphan" in result && result.repairedOrphan
            ? " (auth kullanicisi vardi, profil tamamlandi)"
            : "";
      setCoachFeedback(`Coach hesabi basariyla olusturuldu.${note}`);
      setCoachForm({ fullName: "", email: "", password: "" });
      fetchDashboardData();
    } else {
      setCoachFeedback((result && "error" in result && result.error) || "Coach olusturulurken hata olustu.");
    }
    setCoachSubmitting(false);
  };

  const handleOrgNameSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentOrgId) return;
    setOrgNameSaving(true);
    setOrgNameHint(null);
    const result = await updateOrganizationDisplayNameAction(currentOrgId, orgName);
    if (result?.success) {
      setOrgNameHint("Organizasyon adi kaydedildi. Kenar cubugunu guncellemek icin sayfayi yenileyin.");
    } else {
      setOrgNameHint(result?.error || "Ad guncellenemedi.");
    }
    setOrgNameSaving(false);
  };

  const handleOrgTimeZoneSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentOrgId) return;
    setOrgTimeZoneSaving(true);
    setOrgTimeZoneHint(null);
    const result = await updateOrganizationTimeZoneAction(currentOrgId, orgTimeZone);
    if (result && "success" in result && result.success) {
      setOrgTimeZoneHint("Saat dilimi güncellendi. Performans/Finans ekranları yeni dilime göre hesaplanır.");
    } else {
      setOrgTimeZoneHint((result && "error" in result ? result.error : null) || "Saat dilimi güncellenemedi.");
    }
    setOrgTimeZoneSaving(false);
  };

  if (loading) return (
    <div className="flex min-h-[50dvh] min-w-0 flex-col items-center justify-center space-y-6 overflow-x-hidden px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
      <Loader2 className="animate-spin text-[color:var(--peaker-ui-PRIMARY)]" size={40} aria-hidden />
      <span className="animate-pulse text-center text-[9px] font-black uppercase italic tracking-[0.5em] text-white">
        Veri İzolasyonu Sağlanıyor
      </span>
    </div>
  );

  if (loadError) {
    return (
      <div className="flex min-h-[50dvh] min-w-0 flex-col items-center justify-center gap-4 px-4 text-center">
        <AlertCircle className="size-10 text-red-300" aria-hidden />
        <p className="max-w-md text-sm font-semibold text-red-200">{loadError}</p>
        <button
          type="button"
          onClick={() => void fetchDashboardData()}
          className="ui-btn-primary min-h-11 px-5 text-[10px] font-black uppercase tracking-widest"
        >
          Tekrar dene
        </button>
      </div>
    );
  }

  if (role === "super_admin") return null;

  const canCreateLessons = Boolean(coachPermissions?.can_create_lessons);
  const canTakeAttendance = Boolean(coachPermissions?.can_take_attendance);
  const canManageTrainingNotes = Boolean(coachPermissions?.can_manage_training_notes);
  const canViewReports = Boolean(coachPermissions?.can_view_reports);

  const coachWidgetCtx = (permissionAllowed: boolean): DashboardWidgetVisibilityContext => ({
    roleAllowed: role === "coach",
    permissionAllowed,
    organizationFeatures,
  });
  const adminWidgetCtx: DashboardWidgetVisibilityContext = {
    roleAllowed: role === "admin",
    permissionAllowed: true,
    organizationFeatures,
  };
  const showCoachOpsMetrics = shouldRenderDashboardWidget(
    DASHBOARD_WIDGET_IDS.coachOpsMetrics,
    coachWidgetCtx(true)
  );
  const showCoachPerformanceBand = shouldRenderDashboardWidget(
    DASHBOARD_WIDGET_IDS.coachPerformanceBand,
    coachWidgetCtx(canViewReports)
  );
  const showCoachPrivateSessions = shouldRenderDashboardWidget(
    DASHBOARD_WIDGET_IDS.coachPrivateSessions,
    coachWidgetCtx(canManageTrainingNotes)
  );
  const showCoachNotificationsPreview = shouldRenderDashboardWidget(
    DASHBOARD_WIDGET_IDS.coachNotificationsPreview,
    coachWidgetCtx(true)
  );
  const showAdminOnboardingChecklist = shouldRenderDashboardWidget(
    DASHBOARD_WIDGET_IDS.adminOnboardingChecklist,
    adminWidgetCtx
  );
  const showAdminStatsGrid = shouldRenderDashboardWidget(DASHBOARD_WIDGET_IDS.adminStatsGrid, adminWidgetCtx);
  const showAdminRevenueCard = shouldRenderDashboardWidget(DASHBOARD_WIDGET_IDS.adminRevenueCard, adminWidgetCtx);
  const showAdminTodayLessons = shouldRenderDashboardWidget(DASHBOARD_WIDGET_IDS.adminTodayLessons, adminWidgetCtx);
  const showAdminTeamPayments = shouldRenderDashboardWidget(DASHBOARD_WIDGET_IDS.adminTeamPayments, adminWidgetCtx);
  const showAdminRecentPrograms = shouldRenderDashboardWidget(DASHBOARD_WIDGET_IDS.adminRecentPrograms, adminWidgetCtx);

  if (role === "coach") {
    return (
      <div className="ui-page min-w-0 overflow-x-hidden animate-in fade-in duration-700">
        <header className="flex min-w-0 flex-col justify-between gap-6 border-b border-white/5 pb-6 md:flex-row md:items-end">
          <div className="min-w-0">
            <h1 className="ui-h1">
              GÜNLÜK <span className="text-[color:var(--peaker-ui-PRIMARY)]">OPERASYON</span>
            </h1>
            <p className="ui-lead break-words">
              {orgName} • Bugün ne yapmalıyım?
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <LiveStatusBadge tone="live" label="Yoklama & ders canlı" pulse />
            </div>
          </div>
          <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <CompactMetricCard label="Bugün ders" value={todayLessons.length} tone="purple" />
            <CompactMetricCard
              label="Bekleyen yoklama"
              value={pendingAttendanceLessons.length}
              tone={pendingAttendanceLessons.length > 0 ? "amber" : "emerald"}
            />
            {showCoachOpsMetrics && coachOpsMetrics ? (
              <>
                <CompactMetricCard label="7 gün ders" value={coachOpsMetrics.lessons7d} tone="neutral" />
                <CompactMetricCard label="Yoklama oranı" value={coachOpsMetrics.attendanceRate} tone="sky" />
                <CompactMetricCard label="Aktif sporcu" value={coachOpsMetrics.activeAthletes} tone="emerald" />
              </>
            ) : null}
          </div>
        </header>

        <CoachMobileQuickStrip />

        <section className="ui-card min-w-0">
          <h3 className="ui-h2-sm mb-3">Bugün Öncelik</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            <Link
              href={pendingAttendanceLessons.length > 0 ? `/antrenman-yonetimi?trainingId=${pendingAttendanceLessons[0]?.id}` : "/antrenman-yonetimi"}
              className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-[10px] font-black uppercase text-amber-300 touch-manipulation"
            >
              {pendingAttendanceLessons.length > 0
                ? `${pendingAttendanceLessons.length} derste yoklama bekliyor`
                : "Yoklama tarafı temiz"}
            </Link>
            <Link
              href="/dersler"
              className="rounded-xl border ui-kpi-chip--brand px-4 py-3 text-[10px] font-black uppercase ui-kpi-card__trend touch-manipulation"
            >
              {todayLessons.length > 0 ? "Bugünkü dersleri kontrol et" : "Bugün için ders planla"}
            </Link>
            <Link
              href="/bildirimler"
              className="rounded-xl ui-btn-ghost px-4 py-3 text-[10px] font-black uppercase text-gray-300 touch-manipulation"
            >
              Bildirimleri gözden geçir
            </Link>
          </div>
        </section>

        {showCoachPerformanceBand ? (
          <section className="ui-card min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="ui-h2-sm">Performans özeti</h3>
              <Link href={PATHS.performans} className="text-[9px] font-black uppercase ui-kpi-card__trend hover:text-white">
                Performans merkezi →
              </Link>
            </div>
            <PerformanceOrgSummaryBand athleteCount={coachOpsMetrics?.activeAthletes ?? 0} />
          </section>
        ) : null}

        <section className="ui-card min-w-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 min-w-0">
            <h3 className="ui-h2-sm shrink-0">Bugünkü Derslerim</h3>
            {canCreateLessons && (
              <Link href="/dersler" className="inline-flex justify-center px-3 py-2.5 sm:py-2 rounded-xl ui-btn-primary text-white text-[10px] font-black uppercase touch-manipulation shrink-0">
                Ders Oluştur
              </Link>
            )}
          </div>
          {todayLessons.length === 0 ? (
            <EmptyState
              title="Bugün planlı ders yok"
              description="Haftalık çizelgeden yeni ders ekleyebilir veya mevcut planı kontrol edebilirsiniz."
              primaryAction={canCreateLessons ? { label: "Ders oluştur", href: "/dersler" } : undefined}
              compact
            />
          ) : (
            <div className="grid gap-2">
              {todayLessons.map((lesson) => {
                const pending = (lesson.training_participants || []).filter(
                  (p) => (p.attendance_status || "registered") === "registered"
                ).length;
                const time = new Date(lesson.start_time).toLocaleTimeString("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <CompactListRow
                    key={lesson.id}
                    title={lesson.title}
                    meta={`${time} · ${lesson.location || "Ana Saha"}`}
                    badge={
                      pending === 0
                        ? { label: "Yoklama tamam", tone: "success" }
                        : { label: `${pending} bekliyor`, tone: "warning" }
                    }
                    href={`/dersler/${lesson.id}`}
                    actions={[
                      ...(canTakeAttendance
                        ? [
                            {
                              label: "Yoklama",
                              href: `/antrenman-yonetimi?modul=grup-dersleri&view=yoklama&trainingId=${lesson.id}`,
                              primary: true,
                            },
                          ]
                        : []),
                    ]}
                  />
                );
              })}
            </div>
          )}
        </section>

        {canTakeAttendance && (
          <section className="ui-card">
            <h3 className="ui-h2-sm mb-4">Yoklama Bekleyen Dersler</h3>
            {pendingAttendanceLessons.length === 0 ? (
              <p className="text-[10px] font-bold text-gray-500">Tüm yoklamalar güncel.</p>
            ) : (
              <div className="grid gap-2">
                {pendingAttendanceLessons.map((lesson) => (
                  <CompactListRow
                    key={lesson.id}
                    title={lesson.title}
                    meta="Yoklama bekliyor"
                    badge={{ label: "Acil", tone: "warning" }}
                    href={`/antrenman-yonetimi?modul=grup-dersleri&view=yoklama&trainingId=${lesson.id}`}
                    actions={[
                      {
                        label: "Yoklama al",
                        href: `/antrenman-yonetimi?modul=grup-dersleri&view=yoklama&trainingId=${lesson.id}`,
                        primary: true,
                      },
                    ]}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        <section className="ui-card">
          <h3 className="ui-h2-sm mb-4">Yaklaşan Dersler</h3>
          {upcomingLessons.length === 0 ? (
            <p className="text-gray-500 text-[10px] font-black uppercase italic">Yaklaşan ders yok. Dersler ekranından yeni plan oluşturabilirsiniz.</p>
          ) : (
            <div className="grid gap-2">
              {upcomingLessons.map((lesson) => (
                <div key={lesson.id} className="bg-white/[0.02] rounded-xl px-4 py-3 min-w-0">
                  <p className="text-white text-sm font-black italic uppercase break-words">{lesson.title}</p>
                  <p className="text-[10px] text-gray-500 font-bold italic break-words">
                    {new Date(lesson.start_time).toLocaleString("tr-TR")} • {lesson.location || "Ana Saha"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {showCoachPrivateSessions && coachPrivateSessions.length > 0 ? (
          <section className="ui-card min-w-0">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="ui-h2-sm shrink-0">Yaklaşan özel dersler</h3>
              <Link
                href="/ozel-ders-paketleri"
                className="text-[10px] font-black uppercase text-[color:var(--peaker-ui-PRIMARY)] touch-manipulation shrink-0"
              >
                Paketlere git
              </Link>
            </div>
            <p className="mb-3 text-[10px] font-bold text-gray-500">
              Grup dersi değil; özel ders paketi planı. Tamamlama paket detayından yapılır.
            </p>
            <ul className="grid gap-2">
              {coachPrivateSessions.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/ozel-ders-paketleri/${s.packageId}`}
                    className="block rounded-xl border ui-kpi-chip--brand px-4 py-3 text-[11px] font-bold text-gray-300 touch-manipulation sm:hover:border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_40%,transparent)]"
                  >
                    <span className="text-white">{formatLessonDateTimeTr(s.startsAt)}</span>
                    <span className="mx-2 text-gray-600">·</span>
                    <span className="ui-kpi-card__trend">{s.athleteName || "Sporcu"}</span>
                    {s.packageName ? (
                      <>
                        <span className="mx-2 text-gray-600">·</span>
                        <span className="text-gray-500">{s.packageName}</span>
                      </>
                    ) : null}
                    {s.location ? (
                      <span className="mt-1 block text-[10px] text-gray-600">{s.location}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {canManageTrainingNotes && (
          <section className="ui-card min-w-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 min-w-0">
              <h3 className="ui-h2-sm shrink-0">Sporcu / Program Akisi</h3>
              <Link href="/notlar-haftalik-program" className="inline-flex justify-center px-3 py-2.5 sm:py-2 rounded-xl ui-btn-primary text-white text-[10px] font-black uppercase touch-manipulation shrink-0">
                Yeni Program Yaz
              </Link>
            </div>
            {recentPrograms.length === 0 ? (
              <EmptyState
                title="Kayıt bulunamadı"
                description="Son program akışında görüntülenecek kayıt yok."
                reason="Henüz program/not oluşturulmamış olabilir."
                primaryAction={{ label: "Yeni program yaz", href: "/notlar-haftalik-program" }}
                compact
              />
            ) : (
              <div className="grid gap-2">
                {recentPrograms.map((program) => {
                  const athlete = Array.isArray(program.athlete_profile) ? program.athlete_profile[0] : program.athlete_profile;
                  return (
                    <div key={program.id} className="bg-white/[0.02] rounded-xl px-4 py-3 min-w-0">
                      <p className="text-white text-sm font-black italic uppercase break-words">{program.title || "Program"}</p>
                      <p className="text-[10px] text-gray-500 font-bold italic break-words">
                        Sporcu: {toDisplayName(athlete?.full_name, undefined, "Sporcu")} • {new Date(program.created_at).toLocaleString("tr-TR")}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {showCoachNotificationsPreview ? (
          <section className="ui-card min-w-0">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4 min-w-0">
              <h3 className="ui-h2-sm shrink-0">Bildirimler</h3>
              <Link href="/bildirimler" className="text-[color:var(--peaker-ui-PRIMARY)] text-[10px] font-black uppercase py-2 sm:py-0 touch-manipulation shrink-0">
                TUMUNU GOR
              </Link>
            </div>
            {notificationPreview.length === 0 ? (
              <EmptyState
                title="Kayıt bulunamadı"
                description="Bildirim akışında gösterilecek kayıt yok."
                reason="Bu dönemde yeni sistem bildirimi oluşmamış olabilir."
                primaryAction={{ label: "Bildirim merkezine git", href: "/bildirimler" }}
                compact
              />
            ) : (
              <div className="grid gap-2">
                {notificationPreview.map((n) => (
                  <div key={n.id} className={`rounded-xl px-4 py-3 border min-w-0 ${n.read ? "bg-white/[0.02] border-white/5" : "ui-kpi-chip--brand border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_20%,transparent)]"}`}>
                    <p className="text-white text-xs font-black italic break-words">{n.message}</p>
                    <p className="text-[10px] text-gray-500 font-bold italic">{new Date(n.created_at).toLocaleString("tr-TR")}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="ui-page min-w-0 overflow-x-hidden animate-in fade-in duration-700">
      {/* HEADER - Font boyutu text-7xl'den 5xl'e çekildi */}
      <header className="flex min-w-0 flex-col justify-between gap-6 border-b border-white/5 pb-8 md:flex-row md:items-end">
        <div className="min-w-0">
          <h1 className="ui-h1">
            AKADEMİ <span className="text-[color:var(--peaker-ui-PRIMARY)]">PANELİ</span>
          </h1>
          <p className="ui-lead break-words">
            {orgName} • Performans Yönetim Merkezi
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <LiveStatusBadge tone="live" label="Operasyon canlı" pulse />
            <span className="text-[10px] font-semibold text-gray-500">
              Çevrimiçi özet: <span className="text-gray-400">{presenceCounts.adminOnline}</span> admin ·{" "}
              <span className="text-gray-400">{presenceCounts.coachOnline}</span> koç
            </span>
          </div>
        </div>
        <div className="ui-kpi-chip flex min-w-0 max-w-full flex-row flex-wrap items-center gap-4 px-4 py-3 shadow-xl">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-500/10 text-green-500">
            <Target size={20} />
          </div>
          <div className="min-w-0">
            <p className="ui-kpi-card__label mb-1 text-[8px] leading-none tracking-widest">HEDEF</p>
            <p className="ui-kpi-card__value text-base italic leading-none break-words">
              {attendanceTarget === null ? "VERI YOK" : `%${attendanceTarget} KATILIM`}
            </p>
          </div>
        </div>
      </header>

      {showAdminOnboardingChecklist && onboardingProgress ? <OnboardingChecklist progress={onboardingProgress} /> : null}

      <section className="ui-card min-w-0">
        <h3 className="ui-h2-sm mb-3">Bugün Öncelik</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          <Link
            href={adminPendingAttendance.length > 0 ? `/antrenman-yonetimi?trainingId=${adminPendingAttendance[0]?.id}` : "/antrenman-yonetimi"}
            className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-[10px] font-black uppercase text-amber-300 touch-manipulation"
          >
            {adminPendingAttendance.length > 0
              ? `${adminPendingAttendance.length} derste yoklama bekliyor`
              : "Yoklama tarafı temiz"}
          </Link>
          <Link
            href="/dersler"
            className="rounded-xl border ui-kpi-chip--brand px-4 py-3 text-[10px] font-black uppercase ui-kpi-card__trend touch-manipulation"
          >
            {stats.activeTrainings > 0 ? "Bugünkü dersleri yönet" : "Bugün için ders planla"}
          </Link>
          <Link
            href={`${PATHS.tahsilatMerkezi}?bolum=sporcular`}
            className="rounded-xl ui-btn-ghost px-4 py-3 text-[10px] font-black uppercase text-gray-300 touch-manipulation"
          >
            Aidat bekleyenleri kontrol et
          </Link>
        </div>
      </section>

      {/* STAT CARDS - Grid Gap ve Padding optimize edildi */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 min-w-0">
        {showAdminStatsGrid ? (
          <>
            <StatCard 
              icon={<Users size={20} />} 
              label="Toplam Sporcu" 
              value={stats.totalPlayers} 
              trend="ORGANIZASYON" 
              color="from-[color:var(--peaker-ui-PRIMARY)] to-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_55%,#000)]" 
              action="Sporcu listesini güncel tutun."
            />
            <StatCard 
              icon={<Calendar size={20} />} 
              label="Bugünkü Ders"
              value={stats.activeTrainings} 
              trend={`${adminPendingAttendance.length} YOKLAMA BEKLIYOR`}
              color="from-blue-600 to-indigo-900" 
              action="Önce yoklaması eksik dersleri tamamlayın."
            />
            <StatCard
              icon={<AlertCircle size={20} />}
              label="Bekleyen Yoklama"
              value={adminPendingAttendance.length}
              trend={adminPendingAttendance.length > 0 ? "AKSİYON GEREKLİ" : "TEMİZ"}
              color="from-amber-500 to-orange-900"
              action={adminPendingAttendance.length > 0 ? "Yoklama yönetimine geçin." : "Bugün kritik yoklama beklemiyor."}
            />
          </>
        ) : null}
        {showAdminRevenueCard ? (
          <StatCard 
            icon={<CreditCard size={20} />} 
            label="Aylık Ciro" 
            value={stats.monthlyRevenue === "-" ? "-" : `₺${stats.monthlyRevenue}`} 
            trend={revenueTrend}
            color="from-emerald-500 to-green-900" 
            action="Aidat bekleyenleri finans sayfasından kapatın."
          />
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-w-0">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-8 space-y-6 min-w-0">
          {showAdminTodayLessons ? (
          <section className="ui-card min-w-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 min-w-0">
              <h3 className="ui-h2 min-w-0 break-words">Bugünkü Operasyon Özeti</h3>
              <Link href="/dersler" className="text-[color:var(--peaker-ui-PRIMARY)] text-[10px] font-black uppercase tracking-widest py-2 sm:py-0 touch-manipulation shrink-0">
                DERSLER
              </Link>
            </div>
            {adminTodayLessons.length > 0 ? (
              <div className="grid gap-3">
                {adminTodayLessons.map((lesson) => {
                  const coach = Array.isArray(lesson.coach_profile) ? lesson.coach_profile[0] : lesson.coach_profile;
                  const pendingCount = (lesson.training_participants || []).filter((p) => (p.attendance_status || "registered") === "registered").length;
                  const totalParticipants = (lesson.training_participants || []).length;
                  return (
                    <div key={lesson.id} className="bg-white/[0.02] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-black italic uppercase break-words">{lesson.title}</p>
                        <p className="text-[10px] text-gray-500 font-bold italic break-words">
                          {new Date(lesson.start_time).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} • {toDisplayName(coach?.full_name, undefined, "Koç")} • {lesson.location || "Ana Saha"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase">
                        <span className="px-3 py-1 rounded-xl bg-white/5 text-gray-300">{totalParticipants}/{lesson.capacity || 0}</span>
                        <span className={`px-3 py-1 rounded-xl border ${pendingCount > 0 ? "text-amber-300 border-amber-500/20 bg-amber-500/10" : "text-green-400 border-green-500/20 bg-green-500/10"}`}>
                          {pendingCount > 0 ? `${pendingCount} BEKLIYOR` : "TAMAMLANDI"}
                        </span>
                        <Link href={`/antrenman-yonetimi?trainingId=${lesson.id}`} className="inline-flex min-h-10 items-center rounded-xl border ui-kpi-chip--brand px-3 py-1 ui-kpi-card__trend touch-manipulation">YOKLAMA</Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10">
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest italic">Bugün planlı ders yok.</p>
                <Link href="/dersler" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl ui-btn-primary px-4 py-2 text-[10px] font-black uppercase text-white touch-manipulation">İlk Dersi Oluştur</Link>
              </div>
            )}
          </section>
          ) : null}

          <section className="ui-card relative overflow-hidden min-w-0">
            <h3 className="ui-h2 flex flex-wrap items-center gap-3 mb-8 relative z-10 min-w-0">
              <BarChart3 className="text-[color:var(--peaker-ui-PRIMARY)] shrink-0" size={24} /> <span className="break-words">Coach / Ekip Durumu</span>
            </h3>
            <div className="space-y-6 relative z-10">
              {coaches.length > 0 ? (
                coaches.slice(0, 5).map((coach) => {
                  const todayLoad = adminTodayLessons.filter((lesson) => lesson.coach_id === coach.id).length;
                  const pendingCount = adminTodayLessons
                    .filter((lesson) => lesson.coach_id === coach.id)
                    .reduce(
                      (sum, lesson) =>
                        sum +
                        (lesson.training_participants || []).filter(
                          (participant) => (participant.attendance_status || "registered") === "registered"
                        ).length,
                      0
                    );
                  return (
                    <div key={coach.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between py-4 border-b border-white/5 last:border-0 min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-black italic text-base uppercase tracking-tight break-words">{toDisplayName(coach.full_name, coach.email, "Koç")}</p>
                        <p className="break-all text-[9px] font-bold uppercase italic tracking-widest text-gray-600 sm:break-normal sm:truncate">{coach.email || "E-POSTA YOK"}</p>
                      </div>
                      <div className="text-left sm:text-right shrink-0">
                        <p className="text-[10px] font-black text-[color:var(--peaker-ui-PRIMARY)] uppercase">{todayLoad} DERS</p>
                        <p className={`text-[9px] font-black uppercase ${pendingCount > 0 ? "text-amber-300" : "text-green-400"}`}>
                          {pendingCount > 0 ? `${pendingCount} BEKLEYEN` : "TEMIZ"}
                        </p>
                        <Link href={`/koclar/${coach.id}`} className="inline-flex min-h-10 items-center text-[9px] font-black uppercase text-gray-500 touch-manipulation">DETAY</Link>
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState
                  title="Kayıt bulunamadı"
                  description="Koç listesinde görüntülenecek kayıt bulunamadı."
                  reason="Organizasyonda henüz aktif koç hesabı olmayabilir."
                  primaryAction={{ label: "Koçlar sayfasına git", href: "/koclar" }}
                  compact
                />
              )}
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 ui-kpi-band rounded-full blur-[100px]" />
          </section>

          {showAdminTeamPayments && teamPaymentRows.length > 0 ? (
            <section className="ui-card min-w-0">
              <h3 className="ui-h2 flex flex-wrap items-center gap-3 mb-6 min-w-0">
                <CreditCard className="text-[color:var(--peaker-ui-PRIMARY)] shrink-0" size={22} /> <span className="break-words">Takım tahsilat özeti</span>
              </h3>
              <div className="space-y-3">
                {teamPaymentRows.slice(0, 5).map((row) => (
                  <div
                    key={row.name}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-3 border-b border-white/5 last:border-0 min-w-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-black italic text-sm uppercase tracking-tight break-words">{row.name}</p>
                      <p className="text-[9px] text-gray-600 font-bold uppercase italic tracking-widest">
                        Tamamlanma %{row.completionRate}
                      </p>
                    </div>
                    <p
                      className={`text-[10px] font-black italic uppercase shrink-0 sm:text-right ${ row.warning ? "text-red-400" : "text-green-400" }`}
                    >
                      {row.paymentStatus}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="ui-card min-w-0">
            <h3 className="ui-h2 mb-8 break-words">Son Hareketler</h3>
            <div className="grid gap-4">
              {recentActivities.length > 0 ? recentActivities.slice(0, 3).map((t, i) => (
                <div key={t.id || i} className="p-4 rounded-[1.25rem] bg-white/[0.02] min-w-0">
                  <p className="text-white font-black italic uppercase text-sm break-words">DERS: {t.title}</p>
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest italic break-words">
                    {new Date(t.start_time).toLocaleDateString('tr-TR')} • {t.location || "Merkez"}
                  </p>
                </div>
              )) : (
                <p className="text-gray-500 italic text-center py-6 uppercase font-black text-[10px] tracking-widest">Ders hareketi yok</p>
              )}
              {showAdminRecentPrograms
                ? adminRecentPrograms.slice(0, 2).map((p) => {
                const coach = Array.isArray(p.coach_profile) ? p.coach_profile[0] : p.coach_profile;
                const athlete = Array.isArray(p.athlete_profile) ? p.athlete_profile[0] : p.athlete_profile;
                return (
                  <div key={p.id} className="p-4 rounded-[1.25rem] bg-white/[0.02] min-w-0">
                    <p className="text-white font-black italic uppercase text-sm break-words">PROGRAM: {p.title || "Program"}</p>
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest italic break-words">
                      {toDisplayName(coach?.full_name, undefined, "Koç")} {"->"} {toDisplayName(athlete?.full_name, undefined, "Sporcu")} • {new Date(p.created_at).toLocaleDateString("tr-TR")}
                    </p>
                  </div>
                );
              })
                : null}
              {adminRecentAttendanceUpdates.slice(0, 2).map((item) => (
                <div
                  key={`${item.training_id}-${item.marked_at ?? "x"}`}
                  className="p-4 rounded-[1.25rem] bg-white/[0.02] min-w-0"
                >
                  <p className="text-white font-black italic uppercase text-sm">YOKLAMA GÜNCELLENDİ</p>
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest italic break-words">
                    {item.athlete_name} •{" "}
                    {item.marked_at ? new Date(item.marked_at).toLocaleString("tr-TR") : "—"}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-4 space-y-6 min-w-0">
          {role === "admin" && currentOrgId && (
            <div className="ui-card p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl min-w-0">
              <h3 className="ui-h2 !text-lg mb-4">Organizasyon adi</h3>
              <p className="text-[10px] text-gray-500 font-bold mb-3 leading-relaxed">
                Panel başlığında ve raporlarda görünen isim. Super admin de tüm organizasyonlar için adı değiştirebilir.
              </p>
              <form onSubmit={handleOrgNameSave} className="space-y-3">
                <input
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="ui-input min-h-11 w-full min-w-0 touch-manipulation rounded-2xl px-4 py-3 text-base font-bold italic text-white outline-none focus:border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_60%,transparent)] sm:text-xs"
                  minLength={2}
                  maxLength={120}
                  required
                />
                <button
                  type="submit"
                  disabled={orgNameSaving}
                  className="ui-btn-secondary w-full min-h-11 text-white py-2.5 rounded-2xl text-[10px] font-black uppercase disabled:opacity-50 touch-manipulation"
                >
                  {orgNameSaving ? "Kaydediliyor..." : "Adi kaydet"}
                </button>
              </form>
              {orgNameHint && <p className="mt-2 break-words text-[10px] font-bold text-gray-400">{orgNameHint}</p>}
            </div>
          )}
          {role === "admin" && currentOrgId && (
            <div className="ui-card p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl min-w-0">
              <h3 className="ui-h2 !text-lg mb-4">Saat dilimi</h3>
              <p className="text-[10px] text-gray-500 font-bold mb-3 leading-relaxed">
                Performans, finans ve takvim ekranlarındaki dönem hesapları bu saat dilimine göre yapılır.
                Yurt dışında veya farklı bir bölgedeki firmalar için bu değeri değiştirin.
              </p>
              <form onSubmit={handleOrgTimeZoneSave} className="space-y-3">
                <select
                  value={orgTimeZone}
                  onChange={(e) => setOrgTimeZone(e.target.value)}
                  className="ui-select min-h-11 w-full min-w-0 touch-manipulation rounded-2xl px-4 py-3 text-base font-bold italic text-white outline-none focus:border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_60%,transparent)] sm:text-xs"
                  aria-label="Organizasyon saat dilimi"
                >
                  {listSupportedTimeZones().map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={orgTimeZoneSaving}
                  className="ui-btn-secondary w-full min-h-11 text-white py-2.5 rounded-2xl text-[10px] font-black uppercase disabled:opacity-50 touch-manipulation"
                >
                  {orgTimeZoneSaving ? "Kaydediliyor..." : "Saat dilimini kaydet"}
                </button>
              </form>
              {orgTimeZoneHint && (
                <p className="mt-2 break-words text-[10px] font-bold text-gray-400">{orgTimeZoneHint}</p>
              )}
            </div>
          )}
          {role === "admin" && (
            <div className="ui-card p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl min-w-0">
              <h3 className="ui-h2 !text-lg mb-5 flex flex-wrap items-center gap-3 min-w-0">
                <UserPlus2 size={18} className="text-[color:var(--peaker-ui-PRIMARY)] shrink-0" /> <span className="break-words">Koç Yönetimi</span>
              </h3>

              <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-4 min-w-0">
                <div className="bg-white/[0.02] rounded-xl p-3">
                  <p className="text-[9px] text-gray-600 font-black uppercase">TOPLAM KOÇ</p>
                  <p className="text-2xl text-white font-black italic">{coaches.length}</p>
                </div>
                <div className="bg-white/[0.02] rounded-xl p-3">
                  <p className="text-[9px] text-gray-600 font-black uppercase">BUGÜN AKTİF</p>
                  <p className="text-2xl text-white font-black italic">{activeCoachCountToday}</p>
                </div>
              </div>

              <form onSubmit={handleCoachCreate} className="space-y-3">
                <input
                  required
                  value={coachForm.fullName}
                  onChange={(e) => setCoachForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  placeholder="AD SOYAD"
                  className="ui-input min-h-11 w-full min-w-0 touch-manipulation rounded-2xl px-4 py-3 text-base font-bold uppercase italic text-white outline-none focus:border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_60%,transparent)] sm:text-xs"
                />
                <input
                  required
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  value={coachForm.email}
                  onChange={(e) => setCoachForm((prev) => ({ ...prev, email: normalizeEmailInput(e.target.value) }))}
                  placeholder="E-POSTA"
                  className="ui-input min-h-11 w-full min-w-0 touch-manipulation rounded-2xl px-4 py-3 text-base font-bold italic text-white outline-none focus:border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_60%,transparent)] sm:text-xs"
                />
                <input
                  required
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  value={coachForm.password}
                  onChange={(e) => setCoachForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="Geçici şifre (en az 6 karakter)"
                  className="ui-input min-h-11 w-full min-w-0 touch-manipulation rounded-2xl px-4 py-3 text-base font-bold italic text-white outline-none focus:border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_60%,transparent)] sm:text-xs normal-case"
                  {...PASSWORD_FIELD_PROPS}
                />

                <button
                  type="submit"
                  disabled={coachSubmitting}
                  className="w-full min-h-11 ui-btn-primary disabled:opacity-60 text-white py-3 rounded-2xl text-[10px] font-black italic uppercase tracking-[0.2em] transition-all touch-manipulation"
                >
                  {coachSubmitting ? "OLUSTURULUYOR..." : "YENI KOC EKLE"}
                </button>
              </form>

              {coachFeedback && (
                <p className="mt-3 break-words text-[10px] font-bold uppercase italic tracking-wider text-gray-300">{coachFeedback}</p>
              )}

              <div className="mt-5 pt-5 border-t space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {coaches.length > 0 ? (
                  coaches.slice(0, 5).map((coach) => (
                    <div key={coach.id} className="bg-white/[0.02] rounded-xl p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black italic text-white uppercase break-words">{toDisplayName(coach.full_name, coach.email, "Koç")}</p>
                        <p className="text-[9px] font-bold text-gray-500 italic truncate">{coach.email}</p>
                      </div>
                      <Link href={`/koclar/${coach.id}`} className="text-[9px] text-[color:var(--peaker-ui-PRIMARY)] font-black uppercase shrink-0 touch-manipulation py-1">
                        DETAY
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-3">
                    <p className="text-[10px] text-gray-500 font-bold italic uppercase">Henuz koc yok.</p>
                    <Link href="/koclar" className="mt-2 inline-flex min-h-11 items-center justify-center rounded-xl ui-btn-ghost px-3 py-2 text-[10px] font-black uppercase text-gray-300 touch-manipulation">
                      Koçlar Sayfası
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-gradient-to-br from-[color:color-mix(in_srgb,var(--peaker-ui-SURFACE)_85%,#000)] to-[color:var(--peaker-ui-SURFACE)] p-5 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] relative group cursor-pointer overflow-hidden shadow-2xl min-w-0">
             <h3 className="ui-h2 mb-3 leading-none">Uyarı / Aksiyon</h3>
             <div className="space-y-2 text-[10px] font-bold italic uppercase tracking-wider">
               {adminPendingAttendance.length > 0 ? (
                 <p className="text-amber-300">{adminPendingAttendance.length} dersin yoklaması eksik.</p>
               ) : (
                 <p className="text-green-400">Yoklama tarafında kritik bekleyen yok.</p>
               )}
               {coaches.length === 0 && <p className="text-red-400">Sistemde koç yok, önce koç ekleyin.</p>}
              {stats.totalPlayers === 0 && <p className="text-red-400">Sistemde sporcu yok, sporcu ekleyin.</p>}
               {adminTodayLessons.length === 0 && <p className="text-gray-400">Bugün ders planı yok.</p>}
             </div>
             <div className="mt-6 flex flex-wrap gap-2">
               <Link href="/dersler" className="ui-btn-secondary inline-flex min-h-10 items-center px-3 py-2 rounded-xl text-white text-[10px] font-black uppercase touch-manipulation">DERSLER</Link>
              <Link href="/oyuncular" className="ui-btn-secondary inline-flex min-h-10 items-center px-3 py-2 rounded-xl text-white text-[10px] font-black uppercase touch-manipulation">SPORCULAR</Link>
               <Link href="/koclar" className="ui-btn-secondary inline-flex min-h-10 items-center px-3 py-2 rounded-xl text-white text-[10px] font-black uppercase touch-manipulation">KOCLAR</Link>
             </div>
          </div>

          <div className="group relative min-w-0 overflow-hidden rounded-[2rem] bg-[color:var(--peaker-ui-PRIMARY)] p-5 shadow-2xl sm:rounded-[2.5rem] sm:p-8">
             <div className="absolute -bottom-4 -right-4 opacity-10 transition-transform sm:group-hover:scale-110">
               <AlertCircle size={120} aria-hidden />
             </div>
             <h3 className="mb-3 break-words text-2xl font-black uppercase leading-[0.9] tracking-tighter text-white italic">İzolasyon <br/>Sistemi</h3>
             <p className="mb-8 break-words text-[9px] font-bold uppercase italic tracking-widest text-white/80">
               Verileriniz sadece size özel filtrelenir.
             </p>
             <Link href="/performans/ayarlar" className="block w-full min-h-12 bg-white text-[color:var(--peaker-ui-PRIMARY)] py-4 rounded-xl font-black italic text-[10px] uppercase tracking-widest sm:hover:brightness-90 transition-all shadow-xl text-center touch-manipulation">
               GÜVENLİK
             </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- SUB-COMPONENTS - StatCard font text-5xl'den 4xl'e indirildi ---
function StatCard({ icon, label, value, trend, color, action }: StatCardProps) {
  return (
    <div className="ui-card ui-kpi-card !p-5 sm:!p-7 relative overflow-hidden group sm:hover:border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_30%,transparent)] transition-all min-w-0">
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white mb-4 sm:mb-6 shadow-xl`}>
        {icon}
      </div>
      <p className="ui-kpi-card__label mb-1 leading-none break-words">{label}</p>
      <h2 className="ui-kpi-card__value ui-kpi-card__value-hover min-w-0 break-words text-3xl italic leading-none tracking-tighter sm:text-4xl">
        {value}
      </h2>
      <div className="flex items-start gap-2 mt-4 sm:mt-5 min-w-0">
        <div className="ui-kpi-card__trend-line"></div>
        <p className="ui-kpi-card__trend">{trend}</p>
      </div>
      {action ? (
        <p className="ui-kpi-card__hint mt-3 font-bold">{action}</p>
      ) : null}
    </div>
  );
}
