import { athletePathPermissionRule, isAthleteManagementProfilePath } from "@/lib/navigation/routeRegistry";
import type { AthletePermissionKey, AthletePermissions } from "@/lib/types";
import { DEFAULT_ATHLETE_PERMISSIONS } from "@/lib/types";

type RawAthletePermissionRow = Partial<Record<AthletePermissionKey, boolean>> | null;

export function normalizeAthletePermissions(raw?: RawAthletePermissionRow): AthletePermissions {
  return {
    can_view_morning_report: raw?.can_view_morning_report ?? DEFAULT_ATHLETE_PERMISSIONS.can_view_morning_report,
    can_view_programs: raw?.can_view_programs ?? DEFAULT_ATHLETE_PERMISSIONS.can_view_programs,
    can_view_calendar: raw?.can_view_calendar ?? DEFAULT_ATHLETE_PERMISSIONS.can_view_calendar,
    can_view_notifications: raw?.can_view_notifications ?? DEFAULT_ATHLETE_PERMISSIONS.can_view_notifications,
    can_view_rpe_entry: raw?.can_view_rpe_entry ?? DEFAULT_ATHLETE_PERMISSIONS.can_view_rpe_entry,
    can_view_development_profile:
      raw?.can_view_development_profile ?? DEFAULT_ATHLETE_PERMISSIONS.can_view_development_profile,
    can_view_financial_status: raw?.can_view_financial_status ?? DEFAULT_ATHLETE_PERMISSIONS.can_view_financial_status,
    can_view_performance_metrics:
      raw?.can_view_performance_metrics ?? DEFAULT_ATHLETE_PERMISSIONS.can_view_performance_metrics,
    can_view_wellness_metrics: raw?.can_view_wellness_metrics ?? DEFAULT_ATHLETE_PERMISSIONS.can_view_wellness_metrics,
    can_view_skill_radar: raw?.can_view_skill_radar ?? DEFAULT_ATHLETE_PERMISSIONS.can_view_skill_radar,
  };
}

export function hasAthletePermission(permissions: AthletePermissions, key: AthletePermissionKey) {
  return Boolean(permissions[key]);
}

export function isRouteBlockedForAthlete(pathname: string, permissions: AthletePermissions) {
  if (isAthleteManagementProfilePath(pathname)) return true;
  const rule = athletePathPermissionRule(pathname);
  if (!rule) return false;
  return !permissions[rule.permission];
}
