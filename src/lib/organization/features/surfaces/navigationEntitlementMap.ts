import { ENTITLEMENT_KEYS } from "../keys";
import type { EntitlementKey } from "../types";

/** Dashboard nav item kimligi → entitlement (dashboardNavConfig ile hizali). */
export const NAV_ITEM_IDS = {
  superAdminDashboard: "nav:super_admin.dashboard",
  superAdminSystemHealth: "nav:super_admin.system_health",
  superAdminAuditLog: "nav:super_admin.audit_log",
  managementHome: "nav:management.home",
  managementAthleteManagement: "nav:management.athlete_management",
  managementLessonManagement: "nav:management.lesson_management",
  managementPerformanceReports: "nav:management.performance_reports",
  managementCoachPayments: "nav:management.coach_payments",
  managementCollectionCenter: "nav:management.collection_center",
  managementCoaches: "nav:management.coaches",
  managementAuditLog: "nav:management.audit_log",
  athleteRpeEntry: "nav:athlete.rpe_entry",
  athleteMorningReport: "nav:athlete.morning_report",
  athleteCalendar: "nav:athlete.calendar",
  athleteMyPrograms: "nav:athlete.my_programs",
  athleteMyPrivatePackages: "nav:athlete.my_private_packages",
  athleteNotifications: "nav:athlete.notifications",
  athleteDevelopmentProfile: "nav:athlete.development_profile",
  footerSettings: "nav:footer.settings",
} as const;

export type NavigationEntitlementMapKey = (typeof NAV_ITEM_IDS)[keyof typeof NAV_ITEM_IDS];

export const NAVIGATION_ENTITLEMENT_MAP = {
  [NAV_ITEM_IDS.superAdminDashboard]: ENTITLEMENT_KEYS.core,
  [NAV_ITEM_IDS.superAdminSystemHealth]: ENTITLEMENT_KEYS.core,
  [NAV_ITEM_IDS.superAdminAuditLog]: ENTITLEMENT_KEYS.audit,
  [NAV_ITEM_IDS.managementHome]: ENTITLEMENT_KEYS.core,
  [NAV_ITEM_IDS.managementAthleteManagement]: ENTITLEMENT_KEYS.core,
  [NAV_ITEM_IDS.managementLessonManagement]: ENTITLEMENT_KEYS.core,
  [NAV_ITEM_IDS.managementPerformanceReports]: ENTITLEMENT_KEYS.insightPerformance,
  [NAV_ITEM_IDS.managementCoachPayments]: ENTITLEMENT_KEYS.finance,
  [NAV_ITEM_IDS.managementCollectionCenter]: ENTITLEMENT_KEYS.finance,
  [NAV_ITEM_IDS.managementCoaches]: ENTITLEMENT_KEYS.core,
  [NAV_ITEM_IDS.managementAuditLog]: ENTITLEMENT_KEYS.audit,
  [NAV_ITEM_IDS.athleteRpeEntry]: ENTITLEMENT_KEYS.athlete,
  [NAV_ITEM_IDS.athleteMorningReport]: ENTITLEMENT_KEYS.insightWellnessArchive,
  [NAV_ITEM_IDS.athleteCalendar]: ENTITLEMENT_KEYS.athlete,
  [NAV_ITEM_IDS.athleteMyPrograms]: ENTITLEMENT_KEYS.athlete,
  [NAV_ITEM_IDS.athleteMyPrivatePackages]: ENTITLEMENT_KEYS.privateLessons,
  [NAV_ITEM_IDS.athleteNotifications]: ENTITLEMENT_KEYS.communications,
  [NAV_ITEM_IDS.athleteDevelopmentProfile]: ENTITLEMENT_KEYS.insightDevelopmentHub,
  [NAV_ITEM_IDS.footerSettings]: ENTITLEMENT_KEYS.insightPerformance,
} as const satisfies Record<NavigationEntitlementMapKey, EntitlementKey>;
