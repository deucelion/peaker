import {
  ADMIN_ONLY_PREFIXES,
  ATHLETE_SHARED_ROUTE_PREFIXES,
  ADMIN_ACCOUNT_INFO_ROUTE,
  COACH_ACCOUNT_INFO_ROUTE,
  isAthleteManagementProfilePath,
  isPrivateLessonPackageDetailPath,
  isSporcuBranchAllowedForAthlete,
  matchesAnyPrefix,
  matchesPathPrefix,
  ORG_LIFECYCLE_INFO_ROUTE,
  PATHS,
  PUBLIC_PATH_PREFIXES,
  SPORCU_ACCOUNT_INFO_ROUTE,
  SPORCU_ROLE_NON_BRANCH_PREFIXES,
  SUPER_ADMIN_EXCLUSIVE_PREFIXES,
  MANAGEMENT_ROUTE_PREFIXES,
} from "@/lib/navigation/routeRegistry";

export const ROLE_NAMES = ["super_admin", "admin", "coach", "sporcu"] as const;

export type UserRole = (typeof ROLE_NAMES)[number];

export {
  ADMIN_ACCOUNT_INFO_ROUTE,
  COACH_ACCOUNT_INFO_ROUTE,
  SPORCU_ACCOUNT_INFO_ROUTE,
  ORG_LIFECYCLE_INFO_ROUTE,
  isAthleteManagementProfilePath,
} from "@/lib/navigation/routeRegistry";

/**
 * Bilinen Peaker rollerine güvenli eşleme. Bilinmeyen veya boş değerlerde null döner
 * (varsayılan sporcu atamak yetki sızıntısı riski yaratır).
 */
export function getSafeRole(role: string | null | undefined): UserRole | null {
  if (role == null || !String(role).trim()) return null;
  const normalized = role.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (normalized === "superadmin" || normalized === "super_admin") return "super_admin";
  if (normalized === "administrator") return "admin";
  if (normalized === "athlete" || normalized === "player") return "sporcu";
  return ROLE_NAMES.includes(normalized as UserRole) ? (normalized as UserRole) : null;
}

export function getDefaultRouteForRole(role: UserRole): string {
  if (role === "super_admin") return PATHS.superAdmin;
  if (role === "admin" || role === "coach") return PATHS.home;
  return PATHS.sporcu;
}

export function isPublicRoute(pathname: string): boolean {
  return matchesAnyPrefix(pathname, PUBLIC_PATH_PREFIXES);
}

export function isOrgLifecycleInfoRoute(pathname: string): boolean {
  return matchesPathPrefix(pathname, ORG_LIFECYCLE_INFO_ROUTE);
}

export function isAdminAccountInfoRoute(pathname: string): boolean {
  return matchesPathPrefix(pathname, ADMIN_ACCOUNT_INFO_ROUTE);
}

export function isCoachAccountInfoRoute(pathname: string): boolean {
  return matchesPathPrefix(pathname, COACH_ACCOUNT_INFO_ROUTE);
}

export function isSporcuAccountInfoRoute(pathname: string): boolean {
  return matchesPathPrefix(pathname, SPORCU_ACCOUNT_INFO_ROUTE);
}

export function canAccessRoute(roleInput: string | null | undefined, pathname: string): boolean {
  if (isPublicRoute(pathname)) return true;

  // Oturum açık ama rol çözülemeyen kullanıcılar için bilgi sayfaları (profil/org durumu) her zaman erişilebilir olmalı.
  if (matchesPathPrefix(pathname, ORG_LIFECYCLE_INFO_ROUTE)) return true;
  if (matchesPathPrefix(pathname, ADMIN_ACCOUNT_INFO_ROUTE)) return true;
  if (matchesPathPrefix(pathname, COACH_ACCOUNT_INFO_ROUTE)) return true;
  if (matchesPathPrefix(pathname, SPORCU_ACCOUNT_INFO_ROUTE)) return true;

  const role = getSafeRole(roleInput);
  if (!role) return false;

  if (role === "super_admin") return true;

  if (matchesAnyPrefix(pathname, SUPER_ADMIN_EXCLUSIVE_PREFIXES)) return false;

  if (role === "admin") return true;

  if (role === "coach") {
    if (matchesAnyPrefix(pathname, ADMIN_ONLY_PREFIXES)) return false;
    if (isAthleteManagementProfilePath(pathname)) return true;
    return (
      matchesAnyPrefix(pathname, MANAGEMENT_ROUTE_PREFIXES) ||
      matchesAnyPrefix(pathname, ATHLETE_SHARED_ROUTE_PREFIXES)
    );
  }

  if (matchesAnyPrefix(pathname, ADMIN_ONLY_PREFIXES)) return false;

  if (role === "sporcu") {
    if (isPrivateLessonPackageDetailPath(pathname)) return true;
    if (matchesPathPrefix(pathname, PATHS.sporcu)) {
      return isSporcuBranchAllowedForAthlete(pathname);
    }
    return matchesAnyPrefix(pathname, SPORCU_ROLE_NON_BRANCH_PREFIXES);
  }

  return false;
}

export const routeMatrix = {
  super_admin: {
    readWrite: ["all-organizations", "system-owner"],
  },
  admin: {
    readWrite: ["all-dashboard", "all-athlete", "admin-only"],
  },
  coach: {
    readWrite: ["all-dashboard-except-admin-only", "all-athlete"],
  },
  sporcu: {
    readWrite: ["athlete-only"],
  },
};
