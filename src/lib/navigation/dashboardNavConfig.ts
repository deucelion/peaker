import type { UserRole } from "@/lib/auth/roleMatrix";
import {
  PATHS,
  matchesPathPrefix,
  normalizePathname,
} from "@/lib/navigation/routeRegistry";
import { tr } from "@/lib/i18n/tr";
import type { CoachPermissionKey, CoachPermissions } from "@/lib/types/permission";
import type { AthletePermissionKey, AthletePermissions } from "@/lib/types/athletePermission";
import type { OrganizationFeatures } from "@/lib/organization/features/types";
import type { NavigationEntitlementMapKey } from "@/lib/organization/features/surfaces/navigationEntitlementMap";
import { isNavigationItemFeatureVisible } from "@/lib/navigation/navigationFeatureVisibility";

export type NavSection = "super_admin" | "management" | "athlete" | "footer";

/** layout.tsx içinde lucide bileşen haritasına bağlanır */
export type DashboardNavIcon =
  | "LayoutDashboard"
  | "Activity"
  | "Bolt"
  | "Calendar"
  | "BarChart3"
  | "ClipboardCheck"
  | "Users"
  | "CreditCard"
  | "FileText"
  | "Bell"
  | "User"
  | "TrendingUp"
  | "Settings"
  | "Shield"
  | "Moon";

export type DashboardNavItem = {
  href: string;
  icon: DashboardNavIcon;
  label: string;
  section: NavSection;
  /** NAVIGATION_ENTITLEMENT_MAP lookup kimligi */
  navItemId: NavigationEntitlementMapKey;
  roles: readonly UserRole[];
  /** Yalnızca organizasyon admini */
  adminOnly?: boolean;
  /** Koç için hepsi gerekli; admin bu kontrolden muaf */
  coachNeedsAll?: readonly CoachPermissionKey[];
  /** Sporcu için tek izin */
  athleteNeeds?: AthletePermissionKey;
  activeMatch: "exact" | "prefix";
  activePrefixes?: readonly string[];
  /** sporcu RPE satırı vurgusu */
  variant?: "default" | "highlight";
};

import { NAV_ITEM_IDS } from "@/lib/organization/features/surfaces/navigationEntitlementMap";

export const DASHBOARD_NAV_ITEMS: readonly DashboardNavItem[] = [
  {
    href: PATHS.superAdmin,
    icon: "LayoutDashboard",
    label: tr.nav.superAdmin,
    section: "super_admin",
    navItemId: NAV_ITEM_IDS.superAdminDashboard,
    roles: ["super_admin"],
    activeMatch: "prefix",
  },
  {
    href: PATHS.sistemSaglik,
    icon: "Activity",
    label: tr.nav.systemHealth,
    section: "super_admin",
    navItemId: NAV_ITEM_IDS.superAdminSystemHealth,
    roles: ["super_admin"],
    activeMatch: "exact",
  },

  {
    href: PATHS.home,
    icon: "LayoutDashboard",
    label: "Ana Panel",
    section: "management",
    navItemId: NAV_ITEM_IDS.managementHome,
    roles: ["admin", "coach"],
    activeMatch: "exact",
  },
  {
    href: PATHS.oyuncular,
    icon: "Users",
    label: "Sporcu Yönetimi",
    section: "management",
    navItemId: NAV_ITEM_IDS.managementAthleteManagement,
    roles: ["admin", "coach"],
    activeMatch: "prefix",
    activePrefixes: [PATHS.oyuncular, PATHS.sporcularYeni, PATHS.takimlar, PATHS.sporcu],
  },
  {
    href: PATHS.antrenmanYonetimi,
    icon: "Calendar",
    label: "Ders Yönetimi",
    section: "management",
    navItemId: NAV_ITEM_IDS.managementLessonManagement,
    roles: ["admin", "coach"],
    activeMatch: "prefix",
    activePrefixes: [
      PATHS.antrenmanYonetimi,
      PATHS.dersler,
      PATHS.haftalikDersProgrami,
      PATHS.ozelDersPaketleri,
      PATHS.notlarHaftalikProgram,
    ],
  },
  {
    href: PATHS.performans,
    icon: "Bolt",
    label: "Performans ve Raporlar",
    section: "management",
    navItemId: NAV_ITEM_IDS.managementPerformanceReports,
    roles: ["admin", "coach"],
    coachNeedsAll: ["can_view_reports"],
    activeMatch: "prefix",
    activePrefixes: [PATHS.performans, PATHS.sahaTestleri, PATHS.idmanRaporu],
  },
  {
    href: PATHS.performansWellnessDetay,
    icon: "Moon",
    label: "Wellness Arşivi",
    section: "management",
    navItemId: NAV_ITEM_IDS.managementWellnessArchive,
    roles: ["admin", "coach"],
    coachNeedsAll: ["can_view_reports"],
    activeMatch: "prefix",
    activePrefixes: [PATHS.performansWellnessDetay],
  },
  {
    href: PATHS.finans,
    icon: "CreditCard",
    label: "Sporcu Ödemeleri",
    section: "management",
    navItemId: NAV_ITEM_IDS.managementCoachPayments,
    roles: ["coach"],
    coachNeedsAll: ["can_view_reports"],
    activeMatch: "prefix",
    activePrefixes: [PATHS.finans],
  },
  {
    href: PATHS.tahsilatMerkezi,
    icon: "CreditCard",
    label: "Tahsilat Merkezi",
    section: "management",
    navItemId: NAV_ITEM_IDS.managementCollectionCenter,
    roles: ["admin"],
    activeMatch: "prefix",
    activePrefixes: [PATHS.tahsilatMerkezi, PATHS.muhasebeFinans, PATHS.finans],
  },
  {
    href: PATHS.koclar,
    icon: "Users",
    label: tr.nav.coaches,
    section: "management",
    navItemId: NAV_ITEM_IDS.managementCoaches,
    roles: ["admin"],
    adminOnly: true,
    activeMatch: "prefix",
    activePrefixes: [PATHS.koclar],
  },
  {
    href: PATHS.auditLog,
    icon: "Shield",
    label: "Audit Kayıtları",
    section: "management",
    navItemId: NAV_ITEM_IDS.managementAuditLog,
    roles: ["admin"],
    adminOnly: true,
    activeMatch: "prefix",
    activePrefixes: [PATHS.auditLog],
  },
  {
    href: PATHS.auditLog,
    icon: "Shield",
    label: "Audit Kayıtları",
    section: "super_admin",
    navItemId: NAV_ITEM_IDS.superAdminAuditLog,
    roles: ["super_admin"],
    activeMatch: "prefix",
    activePrefixes: [PATHS.auditLog],
  },

  {
    href: PATHS.anket,
    icon: "TrendingUp",
    label: tr.nav.rpeEntry,
    section: "athlete",
    navItemId: NAV_ITEM_IDS.athleteRpeEntry,
    roles: ["sporcu"],
    athleteNeeds: "can_view_rpe_entry",
    activeMatch: "exact",
    variant: "highlight",
  },
  {
    href: PATHS.sporcuSabahRaporu,
    icon: "Moon",
    label: "Sabah Raporu",
    section: "athlete",
    navItemId: NAV_ITEM_IDS.athleteMorningReport,
    roles: ["sporcu"],
    athleteNeeds: "can_view_morning_report",
    activeMatch: "exact",
  },
  {
    href: PATHS.takvim,
    icon: "Calendar",
    label: "Takvim",
    section: "athlete",
    navItemId: NAV_ITEM_IDS.athleteCalendar,
    roles: ["sporcu"],
    athleteNeeds: "can_view_calendar",
    activeMatch: "exact",
  },
  {
    href: PATHS.programlarim,
    icon: "FileText",
    label: tr.nav.myPrograms,
    section: "athlete",
    navItemId: NAV_ITEM_IDS.athleteMyPrograms,
    roles: ["sporcu"],
    athleteNeeds: "can_view_programs",
    activeMatch: "exact",
  },
  {
    href: PATHS.ozelDersPaketlerim,
    icon: "FileText",
    label: tr.nav.privatePackagesMine,
    section: "athlete",
    navItemId: NAV_ITEM_IDS.athleteMyPrivatePackages,
    roles: ["sporcu"],
    athleteNeeds: "can_view_programs",
    activeMatch: "exact",
  },
  {
    href: PATHS.bildirimler,
    icon: "Bell",
    label: "Bildirimler",
    section: "athlete",
    navItemId: NAV_ITEM_IDS.athleteNotifications,
    roles: ["sporcu"],
    athleteNeeds: "can_view_notifications",
    activeMatch: "exact",
  },
  {
    href: PATHS.sporcu,
    icon: "User",
    label: tr.nav.developmentProfile,
    section: "athlete",
    navItemId: NAV_ITEM_IDS.athleteDevelopmentProfile,
    roles: ["sporcu"],
    athleteNeeds: "can_view_development_profile",
    activeMatch: "exact",
  },

  {
    href: PATHS.performansAyarlar,
    icon: "Settings",
    label: "Ayarlar",
    section: "footer",
    navItemId: NAV_ITEM_IDS.footerSettings,
    roles: ["super_admin", "admin", "coach", "sporcu"],
    activeMatch: "exact",
  },
] as const;

export type DashboardNavVisibilityContext = {
  role: UserRole | null;
  coachPermissions: CoachPermissions | null;
  athletePermissions: AthletePermissions | null;
  organizationFeatures: OrganizationFeatures | null;
};

export function isDashboardNavItemVisible(item: DashboardNavItem, ctx: DashboardNavVisibilityContext): boolean {
  if (!ctx.role || !item.roles.includes(ctx.role)) return false;
  if (item.adminOnly && ctx.role !== "admin") return false;
  if (item.coachNeedsAll?.length && ctx.role === "coach") {
    const coachPermissions = ctx.coachPermissions;
    if (!coachPermissions) return false;
    if (!item.coachNeedsAll.every((k) => Boolean(coachPermissions[k]))) return false;
  } else if (item.athleteNeeds && ctx.role === "sporcu") {
    const athletePermissions = ctx.athletePermissions;
    if (!athletePermissions) return false;
    if (!athletePermissions[item.athleteNeeds]) return false;
  }

  return isNavigationItemFeatureVisible(item.navItemId, ctx.organizationFeatures);
}

export function isDashboardNavItemActive(pathname: string, item: DashboardNavItem): boolean {
  if (item.activePrefixes?.length) {
    return item.activePrefixes.some((base) => matchesPathPrefix(pathname, base));
  }
  const p = normalizePathname(pathname);
  const h = normalizePathname(item.href);
  if (item.activeMatch === "exact") return p === h;
  return matchesPathPrefix(pathname, item.href);
}

export function dashboardNavItemsForSection(section: NavSection): readonly DashboardNavItem[] {
  return DASHBOARD_NAV_ITEMS.filter((i) => i.section === section);
}
