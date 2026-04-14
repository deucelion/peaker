"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { getCoachPermissions } from "@/lib/auth/coachPermissions";
import { DEFAULT_COACH_PERMISSIONS, type CoachPermissions } from "@/lib/types";
import { isInactiveAdminProfile } from "@/lib/admin/lifecycle";
import { isInactiveAthleteProfile, messageIfAthleteCannotOperate } from "@/lib/athlete/lifecycle";
import { isInactiveCoachProfile, messageIfCoachCannotOperate } from "@/lib/coach/lifecycle";
import { PATHS } from "@/lib/navigation/routeRegistry";
import { mapNotification, mapLesson, mapTeamPaymentSummaries } from "@/lib/mappers";
import { toDisplayName } from "@/lib/profile/displayName";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";

type TrainingParticipantLite = { attendance_status?: string | null };
type ScheduleSnippet = { title?: string | null; start_time?: string | null };
type AttendancePreviewJoinRow = {
  attendance_status?: string | null;
  marked_at?: string | null;
  training_schedule?: ScheduleSnippet | ScheduleSnippet[] | null;
};
function firstScheduleSnippet(
  sn: AttendancePreviewJoinRow["training_schedule"]
): ScheduleSnippet | undefined {
  if (sn == null) return undefined;
  return Array.isArray(sn) ? sn[0] : sn;
}
type CoachSnapshotLesson = {
  start_time: string;
  training_participants?: TrainingParticipantLite[] | null;
};
type RawTeamProfileForPayments = {
  team?: string | null;
  payments?: Array<{ status?: string | null }> | null;
};
type AdminTodayLessonRow = {
  coach_id?: string | null;
  training_participants?: TrainingParticipantLite[] | null;
};
type AdminAttendancePreviewRow = {
  training_id: string;
  marked_at: string | null;
  athlete_profile?: { full_name?: string | null; email?: string | null } | Array<{ full_name?: string | null; email?: string | null }> | null;
};
/** Coach dashboard program listesi (page.tsx CoachProgramRow ile uyumlu). */
type CoachDashboardProgramRow = {
  id: string;
  title: string | null;
  created_at: string;
  is_active: boolean | null;
  athlete_profile?: { full_name?: string | null } | Array<{ full_name?: string | null }> | null;
};
/** Admin dashboard program ozeti (page.tsx RecentProgramRow). */
type AdminDashboardProgramRow = {
  id: string;
  title: string | null;
  created_at: string;
  coach_profile?: { full_name?: string | null } | Array<{ full_name?: string | null }> | null;
  athlete_profile?: { full_name?: string | null } | Array<{ full_name?: string | null }> | null;
};
type RecentActivityRow = {
  id: string;
  title: string;
  start_time: string;
  location: string | null;
};
type CoachProfileRow = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  created_at?: string;
  role: string;
};

function normalizePagination(page: number, pageSize: number, maxPageSize = 100) {
  const p = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  const size = Number.isFinite(pageSize) ? Math.min(maxPageSize, Math.max(1, Math.floor(pageSize))) : 25;
  return { from: (p - 1) * size, to: (p - 1) * size + size - 1, page: p, pageSize: size };
}

export async function listLessonsSnapshot(page = 1, pageSize = 50) {
  const resolved = await resolveSessionActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  if (!actor.organizationId) return { error: "Organizasyon bilgisi eksik." };
  if (actor.role !== "admin" && actor.role !== "coach") return { error: "Bu sayfa icin yetkiniz yok." };
  if (actor.role === "coach") {
    const block = messageIfCoachCannotOperate(actor.role, actor.isActive);
    if (block) return { error: block };
  }

  const adminClient = createSupabaseAdminClient();
  const permissions: CoachPermissions =
    actor.role === "coach" ? await getCoachPermissions(actor.id, actor.organizationId) : DEFAULT_COACH_PERMISSIONS;
  const pager = normalizePagination(page, pageSize, 200);

  const [lessonRes, coachRes, athleteRes] = await Promise.all([
    adminClient
      .from("training_schedule")
      .select("*", { count: "exact" })
      .eq("organization_id", actor.organizationId)
      .order("start_time", { ascending: false })
      .range(pager.from, pager.to),
    adminClient.from("profiles").select("id, full_name, email, role").eq("organization_id", actor.organizationId).order("full_name"),
    adminClient
      .from("profiles")
      .select("id, full_name, email, role, is_active")
      .eq("organization_id", actor.organizationId)
      .order("full_name"),
  ]);

  if (lessonRes.error) return { error: `Dersler alinamadi: ${lessonRes.error.message}` };
  if (coachRes.error) return { error: `Koç listesi alinamadi: ${coachRes.error.message}` };
  if (athleteRes.error) return { error: `Sporcu listesi alinamadi: ${athleteRes.error.message}` };

  return {
    role: actor.role,
    permissions,
    actorUserId: actor.id,
    organizationId: actor.organizationId,
    lessons: (lessonRes.data || []).map((row) => mapLesson(row)),
    total: lessonRes.count || 0,
    page: pager.page,
    pageSize: pager.pageSize,
    coaches: (coachRes.data || [])
      .filter((row) => getSafeRole(row.role) === "coach")
      .map((row) => ({ id: row.id, full_name: toDisplayName(row.full_name, row.email, "Koç") })),
    athletes: (athleteRes.data || [])
      .filter((row) => getSafeRole(row.role) === "sporcu")
      .map((row) => ({ id: row.id, full_name: toDisplayName(row.full_name, row.email, "Sporcu"), is_active: row.is_active ?? true })),
  };
}

export async function listCoachDayLessonsSnapshot(coachId: string, lessonDate: string) {
  const resolved = await resolveSessionActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  if (!actor.organizationId) return { error: "Organizasyon bilgisi eksik." };
  if (actor.role !== "admin" && actor.role !== "coach") return { error: "Bu sayfa icin yetkiniz yok." };
  if (actor.role === "coach" && actor.id !== coachId) return { error: "Sadece kendi derslerinizi gorebilirsiniz." };
  const day = lessonDate?.trim();
  if (!day) return { lessons: [] };

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("training_schedule")
    .select("id, title, start_time, end_time")
    .eq("organization_id", actor.organizationId)
    .eq("coach_id", coachId)
    .gte("start_time", `${day}T00:00`)
    .lte("start_time", `${day}T23:59`)
    .neq("status", "cancelled")
    .order("start_time", { ascending: true });
  if (error) return { error: `Koç dersleri alinamadi: ${error.message}` };
  return { lessons: (data || []) as Array<{ id: string; title: string; start_time: string; end_time: string }> };
}

export async function listAttendanceSnapshot(page = 1, pageSize = 100) {
  const resolved = await resolveSessionActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  if (!actor.organizationId) return { error: "Organizasyon bilgisi eksik." };
  if (actor.role !== "admin" && actor.role !== "coach") return { error: "Bu sayfa icin yetkiniz yok." };
  if (actor.role === "coach") {
    const block = messageIfCoachCannotOperate(actor.role, actor.isActive);
    if (block) return { error: block };
  }
  const permissions: CoachPermissions =
    actor.role === "coach" ? await getCoachPermissions(actor.id, actor.organizationId) : DEFAULT_COACH_PERMISSIONS;
  const pager = normalizePagination(page, pageSize, 300);
  const adminClient = createSupabaseAdminClient();

  const trainingsRes = await adminClient
    .from("training_schedule")
    .select("*", { count: "exact" })
    .eq("organization_id", actor.organizationId)
    .order("start_time", { ascending: false })
    .range(pager.from, pager.to);
  if (trainingsRes.error) return { error: `Dersler alinamadi: ${trainingsRes.error.message}` };

  const canViewAllAthletes = actor.role !== "coach" || permissions.can_view_all_athletes;
  let athletes: Array<{ id: string; full_name: string }> = [];
  if (canViewAllAthletes) {
    const athleteRes = await adminClient
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("organization_id", actor.organizationId)
      .order("full_name");
    if (athleteRes.error) return { error: `Sporcu listesi alinamadi: ${athleteRes.error.message}` };
    athletes = (athleteRes.data || [])
      .filter((row) => getSafeRole(row.role) === "sporcu")
      .map((row) => ({ id: row.id, full_name: toDisplayName(row.full_name, row.email, "Sporcu") }));
  }

  return {
    role: actor.role,
    permissions,
    organizationId: actor.organizationId,
    trainings: (trainingsRes.data || []) as Array<Record<string, unknown>>,
    total: trainingsRes.count || 0,
    page: pager.page,
    pageSize: pager.pageSize,
    allPlayers: athletes,
  };
}

export async function listTrainingParticipantsSnapshot(trainingId: string, page = 1, pageSize = 200) {
  const resolved = await resolveSessionActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  if (!actor.organizationId) return { error: "Organizasyon bilgisi eksik." };
  if (actor.role !== "admin" && actor.role !== "coach") return { error: "Bu sayfa icin yetkiniz yok." };
  const adminClient = createSupabaseAdminClient();

  const trainingRes = await adminClient
    .from("training_schedule")
    .select("id, coach_id")
    .eq("id", trainingId)
    .eq("organization_id", actor.organizationId)
    .maybeSingle();
  if (trainingRes.error || !trainingRes.data) return { error: "Ders bulunamadi." };
  if (actor.role === "coach" && trainingRes.data.coach_id !== actor.id) return { error: "Sadece kendi dersinizi gorebilirsiniz." };

  const pager = normalizePagination(page, pageSize, 500);
  const res = await adminClient
    .from("training_participants")
    .select("training_id, profile_id, is_present, attendance_status, marked_by, marked_at", { count: "exact" })
    .eq("training_id", trainingId)
    .range(pager.from, pager.to);
  if (res.error) return { error: `Katilimcilar alinamadi: ${res.error.message}` };

  const rows = (res.data || []) as Array<{
    training_id: string;
    profile_id: string;
    is_present?: boolean | null;
    attendance_status?: string | null;
    marked_by?: string | null;
    marked_at?: string | null;
  }>;
  const profileIds = Array.from(new Set(rows.map((row) => row.profile_id).filter(Boolean)));
  let profileMap = new Map<string, { id: string; full_name: string; email: string | null; position: string | null }>();
  if (profileIds.length > 0) {
    const { data: profileRows, error: profileErr } = await adminClient
      .from("profiles")
      .select("id, full_name, email, position")
      .in("id", profileIds)
      .eq("organization_id", actor.organizationId);
    if (profileErr) return { error: `Katilimci profilleri alinamadi: ${profileErr.message}` };
    profileMap = new Map(
      (profileRows || []).map((p) => [
        p.id,
        {
          id: p.id,
          full_name: toDisplayName(p.full_name, p.email, "Sporcu"),
          email: p.email ?? null,
          position: p.position ?? null,
        },
      ])
    );
  }

  const participants = rows.map((row) => {
    const profile = profileMap.get(row.profile_id);
    return {
      ...row,
      profiles: profile || null,
    };
  }) as Array<Record<string, unknown>>;
  return { participants, total: res.count || 0, page: pager.page, pageSize: pager.pageSize };
}

export async function listMyNotificationsSnapshot(page = 1, pageSize = 50) {
  const resolved = await resolveSessionActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  const adminClient = createSupabaseAdminClient();
  const pager = normalizePagination(page, pageSize, 200);

  if (actor.role === "sporcu") {
    const permission = await adminClient
      .from("athlete_permissions")
      .select("can_view_notifications")
      .eq("athlete_id", actor.id)
      .maybeSingle();
    if ((permission.data?.can_view_notifications ?? true) === false) {
      return { error: "Bildirim merkezi sizin icin kapali." };
    }
  }

  const { data, error, count } = await adminClient
    .from("notifications")
    .select("id, user_id, message, read, created_at", { count: "exact" })
    .eq("user_id", actor.id)
    .order("created_at", { ascending: false })
    .range(pager.from, pager.to);
  if (error) return { error: `Bildirimler alinamadi: ${error.message}` };
  return { items: (data || []).map((row) => mapNotification(row)), total: count || 0, page: pager.page, pageSize: pager.pageSize };
}

export async function getAthletePanelSnapshot() {
  const resolved = await resolveSessionActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  if (!actor.organizationId || actor.role !== "sporcu") return { error: "Bu sayfa yalnizca sporcular icindir." };
  const block = messageIfAthleteCannotOperate(actor.role, actor.isActive);
  if (block) return { error: block };

  const adminClient = createSupabaseAdminClient();
  const { data: profile, error: pErr } = await adminClient
    .from("profiles")
    .select("*")
    .eq("id", actor.id)
    .eq("organization_id", actor.organizationId)
    .maybeSingle();
  if (pErr || !profile) return { error: "Sporcu profili alinamadi." };

  const { data: permissionRow } = await adminClient
    .from("athlete_permissions")
    .select("can_view_morning_report, can_view_programs, can_view_calendar, can_view_notifications, can_view_rpe_entry, can_view_development_profile, can_view_financial_status, can_view_performance_metrics, can_view_wellness_metrics, can_view_skill_radar")
    .eq("athlete_id", profile.id)
    .maybeSingle();
  const permissions = {
    can_view_morning_report: permissionRow?.can_view_morning_report ?? true,
    can_view_programs: permissionRow?.can_view_programs ?? true,
    can_view_calendar: permissionRow?.can_view_calendar ?? true,
    can_view_notifications: permissionRow?.can_view_notifications ?? true,
    can_view_rpe_entry: permissionRow?.can_view_rpe_entry ?? true,
    can_view_development_profile: permissionRow?.can_view_development_profile ?? true,
    can_view_financial_status: permissionRow?.can_view_financial_status ?? true,
    can_view_performance_metrics: permissionRow?.can_view_performance_metrics ?? true,
    can_view_wellness_metrics: permissionRow?.can_view_wellness_metrics ?? true,
    can_view_skill_radar: permissionRow?.can_view_skill_radar ?? true,
  };

  const [paymentRes, metricRes, attendanceRes] = await Promise.all([
    permissions.can_view_financial_status
      ? adminClient.from("payments").select("*").eq("profile_id", profile.id).order("due_date", { ascending: false }).limit(1)
      : Promise.resolve({ data: [], error: null }),
    permissions.can_view_performance_metrics
      ? adminClient.from("athlete_metrics").select("*").eq("profile_id", profile.id).order("measurement_date", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    permissions.can_view_development_profile
      ? adminClient
          .from("training_participants")
          .select("attendance_status, marked_at, training_schedule(title, start_time)")
          .eq("profile_id", profile.id)
          .order("marked_at", { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [], error: null }),
  ]);

  return {
    profile,
    permissions,
    payment: (paymentRes.data || [])[0] || null,
    metrics: (metricRes.data || []).map((m) => ({
      tarih: new Date(m.measurement_date).toLocaleDateString("tr-TR", { month: "short" }),
      kilo: m.weight,
      yag: m.body_fat,
    })),
    attendancePreview: (attendanceRes.data || []).map((row: AttendancePreviewJoinRow) => {
      const sched = firstScheduleSnippet(row.training_schedule);
      const st = row.attendance_status || "registered";
      const label = st === "attended" ? "Katıldı" : st === "missed" ? "Gelmedi" : st === "cancelled" ? "İptal" : "Kayıtlı";
      return { title: sched?.title || "Antrenman", at: row.marked_at || sched?.start_time || "", status: label };
    }),
  };
}

export async function getDashboardSnapshot() {
  const resolved = await resolveSessionActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  if (!actor.organizationId) return { role: actor.role };
  const adminClient = createSupabaseAdminClient();

  const orgRes = await adminClient.from("organizations").select("name").eq("id", actor.organizationId).maybeSingle();
  const orgName = orgRes.data?.name || `ORG-${actor.organizationId.slice(0, 8).toUpperCase()}`;

  if (actor.role === "coach") {
    const permissions = await getCoachPermissions(actor.id, actor.organizationId);
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date();
    dayEnd.setHours(23, 59, 59, 999);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const thirtyAgo = new Date();
    thirtyAgo.setDate(thirtyAgo.getDate() - 30);

    const [lessonsRes, notificationRes, lessons7dRes, lessons30dRes, programsRes] = await Promise.all([
      adminClient
        .from("training_schedule")
        .select("id, title, start_time, end_time, location, capacity, training_participants(attendance_status)")
        .eq("organization_id", actor.organizationId)
        .eq("coach_id", actor.id)
        .gte("start_time", dayStart.toISOString())
        .neq("status", "cancelled")
        .order("start_time", { ascending: true }),
      adminClient.from("notifications").select("id, message, read, created_at").eq("user_id", actor.id).order("created_at", { ascending: false }).limit(5),
      adminClient
        .from("training_schedule")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", actor.organizationId)
        .eq("coach_id", actor.id)
        .gte("start_time", weekAgo.toISOString())
        .neq("status", "cancelled"),
      adminClient
        .from("training_schedule")
        .select("id")
        .eq("organization_id", actor.organizationId)
        .eq("coach_id", actor.id)
        .gte("start_time", thirtyAgo.toISOString())
        .neq("status", "cancelled"),
      permissions.can_manage_training_notes
        ? adminClient
            .from("athlete_programs")
            .select("id, title, created_at, is_active, athlete_profile:profiles!athlete_programs_athlete_id_fkey(full_name)")
            .eq("organization_id", actor.organizationId)
            .eq("coach_id", actor.id)
            .order("created_at", { ascending: false })
            .limit(6)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (lessonsRes.error) return { error: lessonsRes.error.message };
    const lessons = (lessonsRes.data || []) as CoachSnapshotLesson[];
    const todayLessons = lessons.filter((lesson) => {
      const d = new Date(lesson.start_time).getTime();
      return d >= dayStart.getTime() && d <= dayEnd.getTime();
    });
    const upcomingLessons = lessons.filter((lesson) => new Date(lesson.start_time).getTime() > dayEnd.getTime()).slice(0, 6);
    const pendingAttendanceLessons = todayLessons.filter((lesson) =>
      (lesson.training_participants || []).some((p) => (p.attendance_status || "registered") === "registered")
    );

    const lessonIds30d = ((lessons30dRes.data || []) as Array<{ id: string }>).map((r) => r.id);
    let attendanceRate = "-";
    let activeAthletes = 0;
    if (lessonIds30d.length > 0) {
      const partRes = await adminClient.from("training_participants").select("profile_id, attendance_status").in("training_id", lessonIds30d);
      const rows = (partRes.data || []) as Array<{ profile_id: string; attendance_status?: string | null }>;
      activeAthletes = new Set(rows.map((r) => r.profile_id)).size;
      const marked = rows.filter((r) => r.attendance_status === "attended" || r.attendance_status === "missed");
      const attended = marked.filter((r) => r.attendance_status === "attended").length;
      attendanceRate = marked.length > 0 ? `${Math.round((attended / marked.length) * 100)}%` : "-";
    }

    return {
      role: actor.role,
      orgName,
      organizationId: actor.organizationId,
      coach: {
        permissions,
        todayLessons,
        upcomingLessons,
        pendingAttendanceLessons,
        notificationPreview: (notificationRes.data || []) as Array<{ id: string; message: string; read: boolean; created_at: string }>,
        recentPrograms: (programsRes.data || []) as CoachDashboardProgramRow[],
        opsMetrics: {
          lessons7d: lessons7dRes.count ?? 0,
          attendanceRate,
          activeAthletes,
        },
        activeTrainings: lessons.length,
      },
    };
  }

  if (actor.role !== "admin") return { role: actor.role, orgName, organizationId: actor.organizationId };

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date();
  dayEnd.setHours(23, 59, 59, 999);

  const [playersRes, trainingRes, recentRes, coachRes, participantsRes, paymentsRes, teamProfilesRes, todayLessonsRes, recentAttendanceRes] = await Promise.all([
    adminClient.from("profiles").select("*", { count: "exact", head: true }).eq("organization_id", actor.organizationId).eq("role", "sporcu"),
    adminClient.from("training_schedule").select("*", { count: "exact", head: true }).eq("organization_id", actor.organizationId),
    adminClient.from("training_schedule").select("id, title, start_time, location").eq("organization_id", actor.organizationId).order("start_time", { ascending: false }).limit(4),
    adminClient.from("profiles").select("id, full_name, email, created_at, role").eq("organization_id", actor.organizationId).order("created_at", { ascending: false }),
    adminClient.from("training_participants").select("attendance_status, training_schedule!inner(organization_id)").eq("training_schedule.organization_id", actor.organizationId),
    adminClient.from("payments").select("amount, status").eq("organization_id", actor.organizationId),
    adminClient.from("profiles").select("id, team, payments(status)").eq("organization_id", actor.organizationId).eq("role", "sporcu"),
    adminClient
      .from("training_schedule")
      .select("id, title, start_time, location, capacity, coach_id, coach_profile:profiles!training_schedule_coach_id_fkey(full_name), training_participants(attendance_status)")
      .eq("organization_id", actor.organizationId)
      .gte("start_time", dayStart.toISOString())
      .lte("start_time", dayEnd.toISOString())
      .neq("status", "cancelled")
      .order("start_time", { ascending: true }),
    adminClient
      .from("training_participants")
      .select("training_id, marked_at, athlete_profile:profiles!training_participants_profile_id_fkey(full_name, email)")
      .not("marked_at", "is", null)
      .order("marked_at", { ascending: false })
      .limit(5),
  ]);

  const participantRows = (participantsRes.data || []) as Array<{ attendance_status?: string | null }>;
  const paymentRows = (paymentsRes.data || []) as Array<{ amount: number | null; status: string | null }>;
  const attendanceRate = participantRows.length > 0
    ? Math.round((participantRows.filter((p) => (p.attendance_status || "registered") === "attended").length / participantRows.length) * 100).toString()
    : "-";
  const monthlyRevenue = paymentRows.length > 0
    ? paymentRows.filter((p) => p.status === "odendi").reduce((sum, p) => sum + (Number(p.amount) || 0), 0).toLocaleString("tr-TR")
    : "-";
  const paidCount = paymentRows.filter((p) => p.status === "odendi").length;
  const revenueTrend = paymentRows.length > 0 ? `%${Math.round((paidCount / paymentRows.length) * 100)} TAHSILAT` : "VERI YOK";

  const adminTodayLessons = (todayLessonsRes.data || []) as AdminTodayLessonRow[];
  const adminPendingAttendance = adminTodayLessons.filter((lesson) =>
    (lesson.training_participants || []).some((p) => (p.attendance_status || "registered") === "registered")
  );
  const activeCoachCountToday = new Set(adminTodayLessons.map((lesson) => lesson.coach_id).filter(Boolean)).size;
  const teamStats = mapTeamPaymentSummaries((teamProfilesRes.data || []) as RawTeamProfileForPayments[])
    .map((item) => ({
      name: item.teamName,
      completionRate: item.completionRate,
      paymentStatus: item.pendingPlayers > 0 ? `${item.pendingPlayers} EKSIK` : "TAMAM",
      warning: item.pendingPlayers > 0,
    }))
    .sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 3);

  const { data: programsData } = await adminClient
    .from("athlete_programs")
    .select("id, title, created_at, coach_profile:profiles!athlete_programs_coach_id_fkey(full_name), athlete_profile:profiles!athlete_programs_athlete_id_fkey(full_name)")
    .eq("organization_id", actor.organizationId)
    .order("created_at", { ascending: false })
    .limit(6);

  return {
    role: actor.role,
    orgName,
    organizationId: actor.organizationId,
    admin: {
      stats: {
        totalPlayers: playersRes.count || 0,
        activeTrainings: trainingRes.count || 0,
        attendanceRate,
        monthlyRevenue,
      },
      attendanceTrend:
        Number.isNaN(Number(attendanceRate)) ? "VERI YOK" : Number(attendanceRate) >= 90 ? "HEDEF USTU" : Number(attendanceRate) >= 75 ? "HEDEFE YAKIN" : "GELISIM GEREKLI",
      revenueTrend,
      recentActivities: (recentRes.data || []) as RecentActivityRow[],
      coaches: ((coachRes.data || []) as CoachProfileRow[]).filter((r) => getSafeRole(r.role) === "coach"),
      teamStats,
      adminTodayLessons,
      adminPendingAttendance,
      activeCoachCountToday,
      adminRecentPrograms: (programsData || []) as AdminDashboardProgramRow[],
      adminRecentAttendanceUpdates: ((recentAttendanceRes.data || []) as AdminAttendancePreviewRow[]).map((row) => {
        const athlete = Array.isArray(row.athlete_profile) ? row.athlete_profile[0] : row.athlete_profile;
        return {
          training_id: row.training_id,
          marked_at: row.marked_at,
          athlete_name: toDisplayName(athlete?.full_name, athlete?.email, "Sporcu"),
        };
      }),
    },
  };
}

/**
 * Ana dashboard (/): bootstrap ile redirect / snapshot / hata (ayri /api/me-role cagrisi yok).
 */
export async function bootstrapTenantHomeDashboard(): Promise<
  | { redirectTo: string }
  | { snapshot: Awaited<ReturnType<typeof getDashboardSnapshot>> }
  | { loadError: string }
> {
  const resolved = await resolveSessionActor();
  if ("error" in resolved) {
    const msg = resolved.error;
    if (msg === "Gecersiz oturum.") return { redirectTo: "/login" };
    if (msg === "Profil dogrulanamadi." || msg === "Gecersiz rol.") {
      return { redirectTo: "/org-durumu?reason=profile_missing" };
    }
    return { loadError: msg };
  }

  const { actor } = resolved;
  if (isInactiveAdminProfile(actor.role, actor.isActive)) {
    return { redirectTo: PATHS.adminAccount };
  }
  if (isInactiveCoachProfile(actor.role, actor.isActive)) {
    return { redirectTo: PATHS.coachAccount };
  }
  if (isInactiveAthleteProfile(actor.role, actor.isActive)) {
    return { redirectTo: PATHS.athleteAccount };
  }

  if (actor.role === "super_admin") return { redirectTo: "/super-admin" };
  if (actor.role === "sporcu") return { redirectTo: "/sporcu" };

  const snapshot = await getDashboardSnapshot();
  if (snapshot && typeof snapshot === "object" && "error" in snapshot && snapshot.error) {
    return { loadError: snapshot.error };
  }
  return { snapshot };
}
