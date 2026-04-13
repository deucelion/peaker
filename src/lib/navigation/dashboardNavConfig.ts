import type { UserRole } from "@/lib/auth/roleMatrix";
import {
  PATHS,
  matchesPathPrefix,
  normalizePathname,
} from "@/lib/navigation/routeRegistry";
import { tr } from "@/lib/i18n/tr";
import type { CoachPermissionKey, CoachPermissions } from "@/lib/types/permission";
import type { AthletePermissionKey, AthletePermissions } from "@/lib/types/athletePermission";

export type NavSection = "super_admin" | "management" | "athlete" | "footer";

/** Yönetim menüsü iki blokta gösterilir (sidebar başlıkları) */
export type ManagementNavGroup = "analysis" | "operations";

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
  | "Settings";

export type DashboardNavItem = {
  href: string;
  icon: DashboardNavIcon;
  label: string;
  section: NavSection;
  roles: readonly UserRole[];
  /** Yalnızca organizasyon admini */
  adminOnly?: boolean;
  /** Koç için hepsi gerekli; admin bu kontrolden muaf */
  coachNeedsAll?: readonly CoachPermissionKey[];
  /** Sporcu için tek izin */
  athleteNeeds?: AthletePermissionKey;
  activeMatch: "exact" | "prefix";
  /** sporcu RPE satırı vurgusu */
  variant?: "default" | "highlight";
  managementGroup?: ManagementNavGroup;
};

export const DASHBOARD_NAV_ITEMS: readonly DashboardNavItem[] = [
  { href: PATHS.superAdmin, icon: "LayoutDashboard", label: tr.nav.superAdmin, section: "super_admin", roles: ["super_admin"], activeMatch: "prefix" },
  { href: PATHS.sistemSaglik, icon: "Activity", label: tr.nav.systemHealth, section: "super_admin", roles: ["super_admin"], activeMatch: "exact" },

  {
    href: PATHS.home,
    icon: "LayoutDashboard",
    label: "Dashboard",
    section: "management",
    roles: ["admin", "coach"],
    activeMatch: "exact",
    managementGroup: "analysis",
  },
  {
    href: PATHS.performans,
    icon: "Bolt",
    label: "Performans",
    section: "management",
    roles: ["admin", "coach"],
    coachNeedsAll: ["can_view_reports"],
    activeMatch: "prefix",
    managementGroup: "analysis",
  },
  {
    href: PATHS.dersler,
    icon: "Calendar",
    label: "Dersler",
    section: "management",
    roles: ["admin", "coach"],
    activeMatch: "prefix",
    managementGroup: "analysis",
  },
  {
    href: PATHS.sahaTestleri,
    icon: "BarChart3",
    label: "Saha Testleri",
    section: "management",
    roles: ["admin", "coach"],
    coachNeedsAll: ["can_view_reports"],
    activeMatch: "prefix",
    managementGroup: "analysis",
  },
  {
    href: PATHS.idmanRaporu,
    icon: "ClipboardCheck",
    label: "İdman Raporu",
    section: "management",
    roles: ["admin", "coach"],
    coachNeedsAll: ["can_view_reports"],
    activeMatch: "exact",
    managementGroup: "analysis",
  },
  {
    href: PATHS.oyuncular,
    icon: "Users",
    label: tr.nav.players,
    section: "management",
    roles: ["admin", "coach"],
    activeMatch: "exact",
    managementGroup: "operations",
  },
  {
    href: PATHS.finans,
    icon: "CreditCard",
    label: "Aidat Takibi",
    section: "management",
    roles: ["admin"],
    adminOnly: true,
    activeMatch: "exact",
    managementGroup: "operations",
  },
  {
    href: PATHS.koclar,
    icon: "Users",
    label: tr.nav.coaches,
    section: "management",
    roles: ["admin"],
    adminOnly: true,
    activeMatch: "prefix",
    managementGroup: "operations",
  },
  {
    href: PATHS.notlarHaftalikProgram,
    icon: "FileText",
    label: tr.nav.notesWeekly,
    section: "management",
    roles: ["admin", "coach"],
    coachNeedsAll: ["can_manage_training_notes"],
    activeMatch: "exact",
    managementGroup: "operations",
  },
  {
    href: PATHS.ozelDersPaketleri,
    icon: "FileText",
    label: tr.nav.privatePackages,
    section: "management",
    roles: ["admin", "coach"],
    coachNeedsAll: ["can_manage_training_notes"],
    activeMatch: "exact",
    managementGroup: "operations",
  },
  {
    href: PATHS.antrenmanYonetimi,
    icon: "CreditCard",
    label: "Antrenman & Yoklama",
    section: "management",
    roles: ["admin", "coach"],
    activeMatch: "exact",
    managementGroup: "operations",
  },

  {
    href: PATHS.anket,
    icon: "TrendingUp",
    label: tr.nav.rpeEntry,
    section: "athlete",
    roles: ["sporcu"],
    athleteNeeds: "can_view_rpe_entry",
    activeMatch: "exact",
    variant: "highlight",
  },
  { href: PATHS.takvim, icon: "Calendar", label: "Takvim", section: "athlete", roles: ["sporcu"], athleteNeeds: "can_view_calendar", activeMatch: "exact" },
  {
    href: PATHS.programlarim,
    icon: "FileText",
    label: tr.nav.myPrograms,
    section: "athlete",
    roles: ["sporcu"],
    athleteNeeds: "can_view_programs",
    activeMatch: "exact",
  },
  {
    href: PATHS.ozelDersPaketlerim,
    icon: "FileText",
    label: tr.nav.privatePackagesMine,
    section: "athlete",
    roles: ["sporcu"],
    athleteNeeds: "can_view_programs",
    activeMatch: "exact",
  },
  {
    href: PATHS.bildirimler,
    icon: "Bell",
    label: "Bildirimler",
    section: "athlete",
    roles: ["sporcu"],
    athleteNeeds: "can_view_notifications",
    activeMatch: "exact",
  },
  {
    href: PATHS.sporcu,
    icon: "User",
    label: tr.nav.developmentProfile,
    section: "athlete",
    roles: ["sporcu"],
    athleteNeeds: "can_view_development_profile",
    activeMatch: "exact",
  },

  {
    href: PATHS.performansAyarlar,
    icon: "Settings",
    label: "Ayarlar",
    section: "footer",
    roles: ["super_admin", "admin", "coach", "sporcu"],
    activeMatch: "exact",
  },
] as const;

export function isDashboardNavItemVisible(
  item: DashboardNavItem,
  ctx: {
    role: UserRole | null;
    coachPermissions: CoachPermissions;
    athletePermissions: AthletePermissions;
  }
): boolean {
  if (!ctx.role || !item.roles.includes(ctx.role)) return false;
  if (item.adminOnly && ctx.role !== "admin") return false;
  if (item.coachNeedsAll?.length && ctx.role === "coach") {
    return item.coachNeedsAll.every((k) => Boolean(ctx.coachPermissions[k]));
  }
  if (item.athleteNeeds && ctx.role === "sporcu") {
    return Boolean(ctx.athletePermissions[item.athleteNeeds]);
  }
  return true;
}

export function isDashboardNavItemActive(pathname: string, item: DashboardNavItem): boolean {
  const p = normalizePathname(pathname);
  const h = normalizePathname(item.href);
  if (item.activeMatch === "exact") return p === h;
  return matchesPathPrefix(pathname, item.href);
}

export function dashboardNavItemsForSection(section: NavSection): readonly DashboardNavItem[] {
  return DASHBOARD_NAV_ITEMS.filter((i) => i.section === section);
}

export function visibleManagementNavItems(
  group: ManagementNavGroup,
  ctx: {
    role: UserRole | null;
    coachPermissions: CoachPermissions;
    athletePermissions: AthletePermissions;
  }
): DashboardNavItem[] {
  return DASHBOARD_NAV_ITEMS.filter(
    (item) =>
      item.section === "management" &&
      item.managementGroup === group &&
      isDashboardNavItemVisible(item, ctx)
  );
}
