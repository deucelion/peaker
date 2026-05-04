"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { getCoachPermissions } from "@/lib/auth/coachPermissions";
import { messageIfCoachCannotOperate } from "@/lib/coach/lifecycle";
import { DEFAULT_COACH_PERMISSIONS } from "@/lib/types";
import { toDisplayName } from "@/lib/profile/displayName";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { computeFinanceStatusSummary } from "@/lib/finance/paymentSummary";
import type { PaymentRow } from "@/types/domain";
import { isoToZonedDateKey, SCHEDULE_APP_TIME_ZONE } from "@/lib/schedule/scheduleWallTime";
import { istanbulDateWallRangeToHalfOpenUtc } from "@/lib/accountingFinance/istanbulQueryRange";

type ManagementRole = "admin" | "coach";
type DailyTrainingLoadReport = {
  id: string;
  rpe_score: number;
  duration_minutes: number;
  total_load: number;
  measurement_date: string;
  profiles: {
    full_name: string | null;
    position: string | null;
    number: string | null;
    organization_id: string | null;
  };
};

async function resolveManagementActor() {
  const resolved = await resolveSessionActor();
  if ("error" in resolved) return { error: resolved.error };
  const sa = resolved.actor;
  if (sa.role !== "admin" && sa.role !== "coach") {
    return { error: "Bu islem icin yetkiniz yok." as const };
  }
  const organizationId = sa.organizationId;
  if (!organizationId) return { error: "Organizasyon bilgisi alinamadi." as const };
  if (sa.role === "coach") {
    const coachBlock = messageIfCoachCannotOperate(sa.role, sa.isActive ?? true);
    if (coachBlock) return { error: coachBlock };
  }
  return {
    actorId: sa.id,
    role: sa.role as ManagementRole,
    organizationId,
  };
}

export async function listManagementDirectory() {
  const resolved = await resolveManagementActor();
  if ("error" in resolved) return { error: resolved.error };

  const adminClient = createSupabaseAdminClient();
  const permissions =
    resolved.role === "coach"
      ? await getCoachPermissions(resolved.actorId, resolved.organizationId)
      : DEFAULT_COACH_PERMISSIONS;

  const canViewAthletes = resolved.role !== "coach" || permissions.can_view_all_athletes;

  const [coachRes, athleteRes] = await Promise.all([
    adminClient
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("organization_id", resolved.organizationId)
      .order("full_name"),
    canViewAthletes
      ? adminClient
          .from("profiles")
          .select("id, full_name, email, role, is_active, team, position, number, height, weight, next_aidat_due_date, next_aidat_amount")
          .eq("organization_id", resolved.organizationId)
          .order("full_name")
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (coachRes.error) return { error: `Koç listesi alınamadı: ${coachRes.error.message}` };
  if (athleteRes.error) return { error: `Sporcu listesi alınamadı: ${athleteRes.error.message}` };

  const coaches = (coachRes.data || [])
    .filter((row) => getSafeRole(row.role) === "coach")
    .map((row) => ({ id: row.id, full_name: toDisplayName(row.full_name, row.email, "Koç") }));

  const athleteIds = (athleteRes.data || [])
    .filter((row) => getSafeRole(row.role) === "sporcu")
    .map((row) => row.id);

  const [packageRes, sessionRes, paymentRes] = await Promise.all([
    athleteIds.length > 0
      ? adminClient
          .from("private_lesson_packages")
          .select("id, athlete_id, package_name, remaining_lessons, payment_status, is_active, updated_at")
          .eq("organization_id", resolved.organizationId)
          .in("athlete_id", athleteIds)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    athleteIds.length > 0
      ? adminClient
          .from("private_lesson_sessions")
          .select("athlete_id, starts_at, status")
          .eq("organization_id", resolved.organizationId)
          .eq("status", "completed")
          .in("athlete_id", athleteIds)
          .order("starts_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    athleteIds.length > 0
      ? adminClient
          .from("payments")
          .select("id, profile_id, organization_id, amount, payment_type, due_date, payment_date, status, total_sessions, remaining_sessions, description")
          .eq("organization_id", resolved.organizationId)
          .in("profile_id", athleteIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (packageRes.error) return { error: `Paket bilgisi alınamadı: ${packageRes.error.message}` };
  if (sessionRes.error) return { error: `Ders geçmişi alınamadı: ${sessionRes.error.message}` };
  if (paymentRes.error) return { error: `Finans bilgisi alınamadı: ${paymentRes.error.message}` };

  const packageByAthlete = new Map<
    string,
    {
      activePackageName: string | null;
      remainingLessons: number | null;
      packagePaymentStatus: string | null;
    }
  >();
  for (const row of packageRes.data || []) {
    if (packageByAthlete.has(row.athlete_id)) continue;
    packageByAthlete.set(row.athlete_id, {
      activePackageName: row.is_active ? row.package_name : null,
      remainingLessons: row.is_active ? Number(row.remaining_lessons) : null,
      packagePaymentStatus: row.payment_status ?? null,
    });
  }

  const lastCompletedSessionByAthlete = new Map<string, string>();
  for (const row of sessionRes.data || []) {
    if (!row.athlete_id || lastCompletedSessionByAthlete.has(row.athlete_id)) continue;
    lastCompletedSessionByAthlete.set(row.athlete_id, row.starts_at as string);
  }

  const paymentsByAthlete = new Map<string, PaymentRow[]>();
  for (const row of paymentRes.data || []) {
    if (!row.profile_id) continue;
    const list = paymentsByAthlete.get(row.profile_id) || [];
    list.push({
      id: row.id,
      profile_id: row.profile_id,
      organization_id: row.organization_id,
      amount: Number(row.amount) || 0,
      payment_type: row.payment_type === "paket" ? "paket" : "aylik",
      due_date: row.due_date,
      payment_date: row.payment_date,
      status: row.status || "bekliyor",
      total_sessions: row.total_sessions != null ? Number(row.total_sessions) : null,
      remaining_sessions: row.remaining_sessions != null ? Number(row.remaining_sessions) : null,
      description: row.description ?? null,
    });
    paymentsByAthlete.set(row.profile_id, list);
  }

  const athletes = (athleteRes.data || [])
    .filter((row) => getSafeRole(row.role) === "sporcu")
    .map((row) => ({
      id: row.id,
      full_name: toDisplayName(row.full_name, row.email, "Sporcu"),
      is_active: row.is_active ?? true,
      team: row.team ?? null,
      position: row.position ?? null,
      number: row.number ?? null,
      height: row.height ?? null,
      weight: row.weight ?? null,
      activePackageName: packageByAthlete.get(row.id)?.activePackageName ?? null,
      remainingLessons: packageByAthlete.get(row.id)?.remainingLessons ?? null,
      packagePaymentStatus: packageByAthlete.get(row.id)?.packagePaymentStatus ?? null,
      lastLessonAt: lastCompletedSessionByAthlete.get(row.id) ?? null,
      financeSummary: computeFinanceStatusSummary({
        aidatPayments: (paymentsByAthlete.get(row.id) || []).filter((p) => p.payment_type === "aylik"),
        plannedNextDueDate: row.next_aidat_due_date ?? null,
        plannedNextAmount: row.next_aidat_amount != null ? Number(row.next_aidat_amount) : null,
        hasPartialPackagePayment: packageByAthlete.get(row.id)?.packagePaymentStatus === "partial",
      }),
    }));

  return {
    role: resolved.role,
    actorUserId: resolved.actorId,
    organizationId: resolved.organizationId,
    permissions,
    coaches,
    athletes,
    athleteCount: athletes.length,
  };
}

export async function listDailyTrainingLoadReports() {
  const resolved = await resolveManagementActor();
  if ("error" in resolved) return { error: resolved.error };

  const permissions =
    resolved.role === "coach"
      ? await getCoachPermissions(resolved.actorId, resolved.organizationId)
      : DEFAULT_COACH_PERMISSIONS;
  if (resolved.role === "coach" && !permissions.can_view_reports) {
    return { error: "Rapor goruntuleme yetkiniz yok." as const };
  }

  const adminClient = createSupabaseAdminClient();
  const todayKey = isoToZonedDateKey(new Date().toISOString(), SCHEDULE_APP_TIME_ZONE);
  const dayRange = istanbulDateWallRangeToHalfOpenUtc(todayKey, todayKey);
  if (!dayRange) {
    return { error: "Gunluk rapor tarihi hesaplanamadi." as const };
  }
  const { data: loadRows, error: loadError } = await adminClient
    .from("training_loads")
    .select("id, profile_id, rpe_score, duration_minutes, total_load, measurement_date")
    .gte("measurement_date", dayRange.from)
    .lt("measurement_date", dayRange.toExclusive)
    .order("measurement_date", { ascending: false });

  if (loadError) return { error: `Raporlar alinamadi: ${loadError.message}` };

  const orgRows = (loadRows || []) as Array<{
    id: string;
    profile_id: string | null;
    rpe_score: number;
    duration_minutes: number;
    total_load: number;
    measurement_date: string;
  }>;
  const profileIds = Array.from(new Set(orgRows.map((r) => r.profile_id).filter(Boolean))) as string[];
  if (profileIds.length === 0) return { reports: [] };

  const { data: profileRows, error: profileError } = await adminClient
    .from("profiles")
    .select("id, full_name, position, number, organization_id")
    .in("id", profileIds)
    .eq("organization_id", resolved.organizationId);

  if (profileError) return { error: `Sporcu profilleri alinamadi: ${profileError.message}` };

  const profileMap = new Map((profileRows || []).map((p) => [p.id, p]));
  const reports: DailyTrainingLoadReport[] = orgRows
    .map((row) => {
      const profile = row.profile_id ? profileMap.get(row.profile_id) : null;
      if (!profile) return null;
      return {
        id: row.id,
        rpe_score: row.rpe_score,
        duration_minutes: row.duration_minutes,
        total_load: row.total_load,
        measurement_date: row.measurement_date,
        profiles: {
          full_name: profile.full_name,
          position: profile.position,
          number: profile.number,
          organization_id: profile.organization_id,
        },
      };
    })
    .filter((row): row is DailyTrainingLoadReport => Boolean(row));

  return { reports };
}
