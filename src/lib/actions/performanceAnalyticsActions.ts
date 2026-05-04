"use server";

import { createSupabaseAdminClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { getCoachPermissions, hasCoachPermission } from "@/lib/auth/coachPermissions";
import { DEFAULT_COACH_PERMISSIONS } from "@/lib/types";
import { messageIfCoachCannotOperate, profileRowIsActive } from "@/lib/coach/lifecycle";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { toDisplayName } from "@/lib/profile/displayName";
import { isUuid } from "@/lib/validation/uuid";
import type { TrainingLoadRow } from "@/types/performance";
import { aggregateTrainingLoadsByCalendarDay } from "@/lib/performance/loadSeries";
import {
  addCalendarDaysToYyyyMmDd,
  isYyyyMmDd,
  istanbulLastNDaysInclusive,
  istanbulLoadFetchRangeForPerformance,
  istanbulTodayKey,
} from "@/lib/performance/performanceDateRange";

function assertUuid(id: string | null | undefined): id is string {
  return isUuid(id);
}

export type PerformanceAnalyticsDateRange = {
  dateFrom: string;
  dateTo: string;
};

export async function listPerformanceAnalyticsData(
  organizationId: string,
  athleteProfileId: string | null,
  dateRange?: PerformanceAnalyticsDateRange | null
) {
  if (!assertUuid(organizationId)) {
    return { error: "Gecersiz organizasyon kimligi." as const };
  }
  if (athleteProfileId !== null && !assertUuid(athleteProfileId)) {
    return { error: "Gecersiz sporcu kimligi." as const };
  }

  const sessionClient = await createServerSupabaseClient();
  const { data: authData, error: authError } = await sessionClient.auth.getUser();
  if (authError || !authData.user) {
    return { error: "Gecersiz oturum." as const };
  }

  const resolved = await resolveSessionActor({ claimRequiresOrganization: true });
  if ("error" in resolved) {
    return { error: resolved.error };
  }
  const actor = resolved.actor;

  if (!actor.organizationId || actor.organizationId !== organizationId) {
    return { error: "Bu organizasyonun performans verisine erisiminiz yok." as const };
  }

  const actorRole = actor.role;
  if (actorRole !== "admin" && actorRole !== "coach") {
    return { error: "Bu sayfa yalnizca yonetici veya koç icindir." as const };
  }
  if (actorRole === "coach") {
    const coachBlock = messageIfCoachCannotOperate(actor.role, actor.isActive);
    if (coachBlock) return { error: coachBlock };
  }

  const permissions =
    actorRole === "coach"
      ? await getCoachPermissions(actor.id, organizationId)
      : DEFAULT_COACH_PERMISSIONS;

  if (actorRole === "coach" && !hasCoachPermission(permissions, "can_view_reports")) {
    return { error: "Performans raporlarini goruntuleme yetkiniz yok." as const };
  }

  const canViewAllAthletes = actorRole !== "coach" || permissions.can_view_all_athletes;
  if (actorRole === "coach" && !canViewAllAthletes) {
    if (athleteProfileId !== null) {
      return { error: "Tum sporculari goruntuleme yetkiniz yok." as const };
    }
    const d = istanbulLastNDaysInclusive(28);
    return {
      loads: [] as Record<string, unknown>[],
      reports: [] as Record<string, unknown>[],
      appliedRange: { dateFrom: d.from, dateTo: d.to },
    };
  }

  if (athleteProfileId) {
    const adminClient = createSupabaseAdminClient();
    const { data: athleteRow } = await adminClient
      .from("profiles")
      .select("id, role, organization_id, is_active")
      .eq("id", athleteProfileId)
      .maybeSingle();
    if (!athleteRow || getSafeRole(athleteRow.role) !== "sporcu" || athleteRow.organization_id !== organizationId) {
      return { error: "Sporcu bulunamadi veya bu organizasyona ait degil." as const };
    }
    if (!profileRowIsActive(athleteRow.is_active)) {
      return { error: "Pasif sporcu icin performans verisi gosterilmez." as const };
    }
  }

  const adminClient = createSupabaseAdminClient();

  const todayKey = istanbulTodayKey();
  const rawTo = dateRange?.dateTo?.trim() ?? "";
  const rawFrom = dateRange?.dateFrom?.trim() ?? "";
  const dateTo = isYyyyMmDd(rawTo) ? rawTo : todayKey;
  const dateFrom = isYyyyMmDd(rawFrom) ? rawFrom : addCalendarDaysToYyyyMmDd(dateTo, -27);
  if (dateFrom > dateTo) {
    return { error: "Baslangic tarihi bitis tarihinden sonra olamaz." as const };
  }

  const loadUtcRange = istanbulLoadFetchRangeForPerformance(dateFrom, dateTo);
  if (!loadUtcRange) {
    return { error: "Antrenman yuku tarih araligi hesaplanamadi." as const };
  }

  let profileIdsForLoads: string[] = [];
  if (athleteProfileId) {
    profileIdsForLoads = [athleteProfileId];
  } else {
    const { data: orgAthletes } = await adminClient
      .from("profiles")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("role", "sporcu");
    profileIdsForLoads = (orgAthletes || []).map((r) => r.id);
  }

  let loads: Record<string, unknown>[] = [];
  if (profileIdsForLoads.length > 0) {
    const { data: loadRows, error: loadError } = await adminClient
      .from("training_loads")
      .select("profile_id, total_load, rpe_score, measurement_date, profiles(full_name, email)")
      .in("profile_id", profileIdsForLoads)
      .gte("measurement_date", loadUtcRange.from)
      .lt("measurement_date", loadUtcRange.toExclusive)
      .order("measurement_date", { ascending: true });
    if (loadError) {
      return { error: `Antrenman yuku verisi alinamadi: ${loadError.message}` as const };
    }
    loads = (loadRows || []).map((row) => {
      const profile = (row as { profiles?: { full_name?: string | null; email?: string | null } }).profiles;
      return {
        ...row,
        profiles: profile
          ? {
              ...profile,
              full_name: toDisplayName(profile.full_name, profile.email, "Sporcu"),
            }
          : null,
      };
    });
  }

  if (profileIdsForLoads.length > 1 && loads.length > 0) {
    const aggregated = aggregateTrainingLoadsByCalendarDay(loads as unknown as TrainingLoadRow[]);
    loads = aggregated.map((row) => ({
      ...row,
      profiles: null,
    })) as Record<string, unknown>[];
  }

  let wellnessQuery = adminClient
    .from("wellness_reports")
    .select(
      "id, profile_id, report_date, resting_heart_rate, fatigue, sleep_quality, muscle_soreness, stress_level, energy_level, notes, profiles(full_name, email, id, organization_id)"
    )
    .eq("profiles.organization_id", organizationId)
    .gte("report_date", dateFrom)
    .lte("report_date", dateTo)
    .order("report_date", { ascending: false })
    .limit(200);

  if (athleteProfileId) {
    wellnessQuery = wellnessQuery.eq("profile_id", athleteProfileId);
  }

  const { data: reports, error: wellnessError } = await wellnessQuery;
  if (wellnessError) {
    return { error: `Wellness verisi alinamadi: ${wellnessError.message}` as const };
  }

  return {
    loads,
    appliedRange: { dateFrom, dateTo },
    reports: (reports || []).map((row) => {
      const profile = (row as { profiles?: { full_name?: string | null; email?: string | null } }).profiles;
      return {
        ...row,
        profiles: profile
          ? {
              ...profile,
              full_name: toDisplayName(profile.full_name, profile.email, "Sporcu"),
            }
          : null,
      };
    }),
  };
}
