/** Koç yetki sütunları (coach_permissions). */
export const COACH_PERMISSION_KEYS = [
  "can_create_lessons",
  "can_edit_lessons",
  "can_view_all_organization_lessons",
  "can_view_all_athletes",
  "can_add_athletes_to_lessons",
  "can_take_attendance",
  "can_view_reports",
  "can_manage_training_notes",
  "can_manage_athlete_profiles",
  "can_manage_teams",
] as const;

export type CoachPermissionKey = (typeof COACH_PERMISSION_KEYS)[number];

export type CoachPermissions = Record<CoachPermissionKey, boolean>;

export const DEFAULT_COACH_PERMISSIONS: CoachPermissions = {
  can_create_lessons: true,
  can_edit_lessons: true,
  can_view_all_organization_lessons: true,
  can_view_all_athletes: true,
  can_add_athletes_to_lessons: true,
  can_take_attendance: true,
  can_view_reports: true,
  can_manage_training_notes: true,
  can_manage_athlete_profiles: true,
  can_manage_teams: true,
};
