import type { CoachPermissionKey, CoachPermissions } from "@/lib/types";
import { COACH_PERMISSION_KEYS, DEFAULT_COACH_PERMISSIONS } from "@/lib/types";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  COACH_REPORT_GATE_PREFIXES,
  COACH_TRAINING_NOTES_PREFIXES,
  matchesPathPrefix,
} from "@/lib/navigation/routeRegistry";

type RawPermissionRow = Partial<Record<CoachPermissionKey, boolean>> | null;

export function normalizeCoachPermissions(raw?: RawPermissionRow): CoachPermissions {
  return {
    can_create_lessons: raw?.can_create_lessons ?? DEFAULT_COACH_PERMISSIONS.can_create_lessons,
    can_edit_lessons: raw?.can_edit_lessons ?? DEFAULT_COACH_PERMISSIONS.can_edit_lessons,
    can_view_all_athletes: raw?.can_view_all_athletes ?? DEFAULT_COACH_PERMISSIONS.can_view_all_athletes,
    can_add_athletes_to_lessons: raw?.can_add_athletes_to_lessons ?? DEFAULT_COACH_PERMISSIONS.can_add_athletes_to_lessons,
    can_take_attendance: raw?.can_take_attendance ?? DEFAULT_COACH_PERMISSIONS.can_take_attendance,
    can_view_reports: raw?.can_view_reports ?? DEFAULT_COACH_PERMISSIONS.can_view_reports,
    can_manage_training_notes: raw?.can_manage_training_notes ?? DEFAULT_COACH_PERMISSIONS.can_manage_training_notes,
    can_manage_athlete_profiles: raw?.can_manage_athlete_profiles ?? DEFAULT_COACH_PERMISSIONS.can_manage_athlete_profiles,
    can_manage_teams: raw?.can_manage_teams ?? DEFAULT_COACH_PERMISSIONS.can_manage_teams,
  };
}

export function hasCoachPermission(permissions: CoachPermissions, key: CoachPermissionKey): boolean {
  return Boolean(permissions[key]);
}

/**
 * Service-role okuma: yalnizca oturum dogrulanmis server action / route icinden,
 * coachId ve organizationId degerlerinin gercekten oturum sahibi ve org ile eslestigi
 * dogrulandiktan sonra cagirin.
 */
export async function getCoachPermissions(coachId: string, organizationId: string | null | undefined) {
  if (!organizationId) return normalizeCoachPermissions();
  const adminClient = createSupabaseAdminClient();
  const { data } = await adminClient
    .from("coach_permissions")
    .select(COACH_PERMISSION_KEYS.join(","))
    .eq("coach_id", coachId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return normalizeCoachPermissions((data as RawPermissionRow) || null);
}

export function isRouteBlockedForCoach(pathname: string, permissions: CoachPermissions) {
  if (COACH_REPORT_GATE_PREFIXES.some((route) => matchesPathPrefix(pathname, route))) {
    return !hasCoachPermission(permissions, "can_view_reports");
  }
  if (COACH_TRAINING_NOTES_PREFIXES.some((route) => matchesPathPrefix(pathname, route))) {
    return !hasCoachPermission(permissions, "can_manage_training_notes");
  }
  return false;
}
