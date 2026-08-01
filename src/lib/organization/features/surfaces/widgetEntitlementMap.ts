import { ENTITLEMENT_KEYS } from "../keys";
import type { EntitlementKey } from "../types";

/** Dashboard widget kimligi → entitlement. */
export const DASHBOARD_WIDGET_IDS = {
  adminStatsGrid: "widget:admin.stats_grid",
  adminRevenueCard: "widget:admin.revenue_card",
  adminTeamPayments: "widget:admin.team_payments",
  adminOnboardingChecklist: "widget:admin.onboarding_checklist",
  adminTodayLessons: "widget:admin.today_lessons",
  adminRecentPrograms: "widget:admin.recent_programs",
  coachOpsMetrics: "widget:coach.ops_metrics",
  coachNotificationsPreview: "widget:coach.notifications_preview",
  coachPrivateSessions: "widget:coach.private_sessions",
  coachPerformanceBand: "widget:coach.performance_band",
} as const;

export type WidgetEntitlementMapKey = (typeof DASHBOARD_WIDGET_IDS)[keyof typeof DASHBOARD_WIDGET_IDS];

export const WIDGET_ENTITLEMENT_MAP = {
  [DASHBOARD_WIDGET_IDS.adminStatsGrid]: ENTITLEMENT_KEYS.core,
  [DASHBOARD_WIDGET_IDS.adminRevenueCard]: ENTITLEMENT_KEYS.finance,
  [DASHBOARD_WIDGET_IDS.adminTeamPayments]: ENTITLEMENT_KEYS.finance,
  [DASHBOARD_WIDGET_IDS.adminOnboardingChecklist]: ENTITLEMENT_KEYS.core,
  [DASHBOARD_WIDGET_IDS.adminTodayLessons]: ENTITLEMENT_KEYS.core,
  [DASHBOARD_WIDGET_IDS.adminRecentPrograms]: ENTITLEMENT_KEYS.core,
  [DASHBOARD_WIDGET_IDS.coachOpsMetrics]: ENTITLEMENT_KEYS.core,
  [DASHBOARD_WIDGET_IDS.coachNotificationsPreview]: ENTITLEMENT_KEYS.communications,
  [DASHBOARD_WIDGET_IDS.coachPrivateSessions]: ENTITLEMENT_KEYS.privateLessons,
  [DASHBOARD_WIDGET_IDS.coachPerformanceBand]: ENTITLEMENT_KEYS.insightPerformance,
} as const satisfies Record<WidgetEntitlementMapKey, EntitlementKey>;
