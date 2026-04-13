"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { getCoachPermissions, hasCoachPermission } from "@/lib/auth/coachPermissions";
import { messageIfAthleteCannotOperate } from "@/lib/athlete/lifecycle";
import { messageIfCoachCannotOperate } from "@/lib/coach/lifecycle";
import type { AthletePermissions, AthletePermissionKey } from "@/lib/types";
import { ATHLETE_PERMISSION_KEYS, DEFAULT_ATHLETE_PERMISSIONS } from "@/lib/types";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { resolveSessionActor, toTenantProfileRow } from "@/lib/auth/resolveSessionActor";
import { isUuid } from "@/lib/validation/uuid";
import { withServerActionGuard } from "@/lib/observability/serverActionError";

function assertUuid(id: string | null | undefined): id is string {
  return isUuid(id);
}

async function resolveActor() {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: true });
  if ("error" in resolved) return { error: resolved.error };
  const actor = toTenantProfileRow(resolved.actor);
  if (!actor.organization_id) return { error: "Kullanici profili dogrulanamadi." as const };
  const coachBlock = messageIfCoachCannotOperate(actor.role, actor.is_active);
  if (coachBlock) return { error: coachBlock };
  const athleteBlock = messageIfAthleteCannotOperate(actor.role, actor.is_active);
  if (athleteBlock) return { error: athleteBlock };
  return { actor };
}

export async function updateAthletePermissions(athleteId: string, updates: Partial<AthletePermissions>) {
  return withServerActionGuard("permission.updateAthletePermissions", async () => {
  if (!assertUuid(athleteId)) {
    return { error: "Gecersiz sporcu kimligi." };
  }

  const resolved = await resolveActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  const role = getSafeRole(actor.role);

  if (role !== "admin" && role !== "coach") return { error: "Bu islem icin yetkiniz yok." };
  if (role === "coach") {
    const coachPermissions = await getCoachPermissions(actor.id, actor.organization_id);
    if (!hasCoachPermission(coachPermissions, "can_view_all_athletes")) {
      return { error: "Sporcu gorunurluk ayari icin yetkiniz yok." };
    }
  }

  const adminClient = createSupabaseAdminClient();
  const { data: athlete } = await adminClient
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", athleteId)
    .eq("organization_id", actor.organization_id)
    .maybeSingle();
  if (!athlete || getSafeRole(athlete.role) !== "sporcu") return { error: "Sporcu bulunamadi." };

  const payload: Partial<Record<AthletePermissionKey, boolean>> = {};
  ATHLETE_PERMISSION_KEYS.forEach((key) => {
    if (typeof updates[key] === "boolean") payload[key] = updates[key];
  });

  const { error } = await adminClient.from("athlete_permissions").upsert(
    {
      athlete_id: athleteId,
      organization_id: actor.organization_id,
      ...DEFAULT_ATHLETE_PERMISSIONS,
      ...payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "athlete_id" }
  );
  if (error) return { error: `Sporcu permission kaydedilemedi: ${error.message}` };

  await logAuditEvent({
    organizationId: actor.organization_id,
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "permission.athlete.update",
    entityType: "athlete_permission",
    entityId: athleteId,
  });

  revalidatePath("/performans/ayarlar");
  revalidatePath("/sporcu");
  revalidatePath("/takvim");
  revalidatePath("/programlarim");
  revalidatePath("/anket");
  revalidatePath("/bildirimler");
  revalidatePath("/sporcu/sabah-raporu");
  return { success: true };
  });
}

type AthleteRowWithPermissions = Record<string, unknown> & {
  id: string;
  permissions?: AthletePermissions;
};

/** Ayarlar > Yetkiler: RLS'den bagimsiz sporcu + athlete_permissions listesi (admin / tum sporculari gorebilen koç). */
export async function listAthletesWithPermissionsForSettings() {
  const resolved = await resolveActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  const role = getSafeRole(actor.role);
  if (role !== "admin" && role !== "coach") {
    return { error: "Bu islem icin yetkiniz yok." as const };
  }

  let canManageVisibility = role === "admin";
  if (role === "coach") {
    const coachPerms = await getCoachPermissions(actor.id, actor.organization_id);
    canManageVisibility = Boolean(coachPerms.can_view_all_athletes);
    if (!canManageVisibility) {
      return { athletes: [] as AthleteRowWithPermissions[], canManageVisibility: false };
    }
  }

  const adminClient = createSupabaseAdminClient();
  const { data: rows, error: rowsError } = await adminClient
    .from("profiles")
    .select("*")
    .eq("organization_id", actor.organization_id)
    .order("full_name");

  if (rowsError) {
    return { error: `Sporcu listesi alinamadi: ${rowsError.message}` as const };
  }

  const data = (rows || []).filter((row) => getSafeRole(String(row.role ?? "")) === "sporcu");
  const athleteIds = data.map((r) => r.id);
  if (athleteIds.length === 0) {
    return { athletes: [] as AthleteRowWithPermissions[], canManageVisibility };
  }

  const { data: permissionRows, error: permError } = await adminClient
    .from("athlete_permissions")
    .select(
      "athlete_id, can_view_morning_report, can_view_programs, can_view_calendar, can_view_notifications, can_view_rpe_entry, can_view_development_profile, can_view_financial_status, can_view_performance_metrics, can_view_wellness_metrics, can_view_skill_radar"
    )
    .in("athlete_id", athleteIds);

  if (permError) {
    return { error: `Sporcu yetkileri alinamadi: ${permError.message}` as const };
  }

  const permissionMap = new Map(
    (permissionRows || []).map((row) => [
      row.athlete_id as string,
      {
        can_view_morning_report: row.can_view_morning_report ?? true,
        can_view_programs: row.can_view_programs ?? true,
        can_view_calendar: row.can_view_calendar ?? true,
        can_view_notifications: row.can_view_notifications ?? true,
        can_view_rpe_entry: row.can_view_rpe_entry ?? true,
        can_view_development_profile: row.can_view_development_profile ?? true,
        can_view_financial_status: row.can_view_financial_status ?? true,
        can_view_performance_metrics: row.can_view_performance_metrics ?? true,
        can_view_wellness_metrics: row.can_view_wellness_metrics ?? true,
        can_view_skill_radar: row.can_view_skill_radar ?? true,
      } satisfies AthletePermissions,
    ])
  );

  const athletes: AthleteRowWithPermissions[] = data.map((athlete) => ({
    ...(athlete as Record<string, unknown>),
    id: athlete.id,
    permissions: permissionMap.get(athlete.id) || DEFAULT_ATHLETE_PERMISSIONS,
  }));

  return { athletes, canManageVisibility };
}

