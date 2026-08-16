import { ENTITLEMENT_KEYS } from "../keys";
import type { EntitlementKey } from "../types";

/** Snapshot action branch kimligi → entitlement. */
export const SNAPSHOT_BRANCH_IDS = {
  listWeeklyLessonSchedule: "snapshot:list_weekly_lesson_schedule",
  listLessons: "snapshot:list_lessons",
  listCoachDayLessons: "snapshot:list_coach_day_lessons",
  listAttendance: "snapshot:list_attendance",
  listTrainingParticipants: "snapshot:list_training_participants",
  listMyNotifications: "snapshot:list_my_notifications",
  dashboardCoachNotifications: "snapshot:dashboard.coach.notifications",
  dashboardCoachPrograms: "snapshot:dashboard.coach.programs",
  dashboardCoachOpsMetrics: "snapshot:dashboard.coach.ops_metrics",
  dashboardAdminFinanceStats: "snapshot:dashboard.admin.finance_stats",
  dashboardAdminFieldTestOnboarding: "snapshot:dashboard.admin.field_test_onboarding",
  dashboardAdminRevenueMetrics: "snapshot:dashboard.admin.revenue_metrics",
  athletePanelFinance: "snapshot:athlete_panel.finance",
  athletePanelPerformanceMetrics: "snapshot:athlete_panel.performance_metrics",
  athletePanelBodyMeasurements: "snapshot:athlete_panel.body_measurements",
  athletePanelDevelopmentHub: "snapshot:athlete_panel.development_hub",
  bootstrapTenantHome: "snapshot:bootstrap_tenant_home",
} as const;

export type SnapshotEntitlementMapKey = (typeof SNAPSHOT_BRANCH_IDS)[keyof typeof SNAPSHOT_BRANCH_IDS];

export const SNAPSHOT_ENTITLEMENT_MAP = {
  [SNAPSHOT_BRANCH_IDS.listWeeklyLessonSchedule]: ENTITLEMENT_KEYS.core,
  [SNAPSHOT_BRANCH_IDS.listLessons]: ENTITLEMENT_KEYS.core,
  [SNAPSHOT_BRANCH_IDS.listCoachDayLessons]: ENTITLEMENT_KEYS.core,
  [SNAPSHOT_BRANCH_IDS.listAttendance]: ENTITLEMENT_KEYS.core,
  [SNAPSHOT_BRANCH_IDS.listTrainingParticipants]: ENTITLEMENT_KEYS.core,
  [SNAPSHOT_BRANCH_IDS.listMyNotifications]: ENTITLEMENT_KEYS.communications,
  [SNAPSHOT_BRANCH_IDS.dashboardCoachNotifications]: ENTITLEMENT_KEYS.communications,
  [SNAPSHOT_BRANCH_IDS.dashboardCoachPrograms]: ENTITLEMENT_KEYS.core,
  [SNAPSHOT_BRANCH_IDS.dashboardCoachOpsMetrics]: ENTITLEMENT_KEYS.core,
  [SNAPSHOT_BRANCH_IDS.dashboardAdminFinanceStats]: ENTITLEMENT_KEYS.finance,
  [SNAPSHOT_BRANCH_IDS.dashboardAdminFieldTestOnboarding]: ENTITLEMENT_KEYS.insightFieldTests,
  [SNAPSHOT_BRANCH_IDS.dashboardAdminRevenueMetrics]: ENTITLEMENT_KEYS.finance,
  [SNAPSHOT_BRANCH_IDS.athletePanelFinance]: ENTITLEMENT_KEYS.finance,
  [SNAPSHOT_BRANCH_IDS.athletePanelPerformanceMetrics]: ENTITLEMENT_KEYS.insightPerformance,
  [SNAPSHOT_BRANCH_IDS.athletePanelBodyMeasurements]: ENTITLEMENT_KEYS.insightBodyMeasurements,
  [SNAPSHOT_BRANCH_IDS.athletePanelDevelopmentHub]: ENTITLEMENT_KEYS.insightDevelopmentHub,
  [SNAPSHOT_BRANCH_IDS.bootstrapTenantHome]: ENTITLEMENT_KEYS.core,
} as const satisfies Record<SnapshotEntitlementMapKey, EntitlementKey>;
