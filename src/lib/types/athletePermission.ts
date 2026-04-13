export const ATHLETE_PERMISSION_KEYS = [
  "can_view_morning_report",
  "can_view_programs",
  "can_view_calendar",
  "can_view_notifications",
  "can_view_rpe_entry",
  "can_view_development_profile",
  "can_view_financial_status",
  "can_view_performance_metrics",
  "can_view_wellness_metrics",
  "can_view_skill_radar",
] as const;

export type AthletePermissionKey = (typeof ATHLETE_PERMISSION_KEYS)[number];
export type AthletePermissions = Record<AthletePermissionKey, boolean>;

export const DEFAULT_ATHLETE_PERMISSIONS: AthletePermissions = {
  can_view_morning_report: true,
  can_view_programs: true,
  can_view_calendar: true,
  can_view_notifications: true,
  can_view_rpe_entry: true,
  can_view_development_profile: true,
  can_view_financial_status: true,
  can_view_performance_metrics: true,
  can_view_wellness_metrics: true,
  can_view_skill_radar: true,
};
