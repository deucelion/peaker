"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { getCoachPermissions } from "@/lib/auth/coachPermissions";
import { messageIfCoachCannotOperate } from "@/lib/coach/lifecycle";
import { DEFAULT_COACH_PERMISSIONS } from "@/lib/types";
import { toDisplayName } from "@/lib/profile/displayName";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";

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
          .select("id, full_name, email, role, is_active")
          .eq("organization_id", resolved.organizationId)
          .order("full_name")
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (coachRes.error) return { error: `Koç listesi alınamadı: ${coachRes.error.message}` };
  if (athleteRes.error) return { error: `Sporcu listesi alınamadı: ${athleteRes.error.message}` };

  const coaches = (coachRes.data || [])
    .filter((row) => getSafeRole(row.role) === "coach")
    .map((row) => ({ id: row.id, full_name: toDisplayName(row.full_name, row.email, "Koç") }));

  const athletes = (athleteRes.data || [])
    .filter((row) => getSafeRole(row.role) === "sporcu")
    .map((row) => ({
      id: row.id,
      full_name: toDisplayName(row.full_name, row.email, "Sporcu"),
      is_active: row.is_active ?? true,
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
  const today = new Date().toISOString().split("T")[0];
  const { data: loadRows, error: loadError } = await adminClient
    .from("training_loads")
    .select("id, profile_id, rpe_score, duration_minutes, total_load, measurement_date")
    .gte("measurement_date", `${today}T00:00:00`)
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
