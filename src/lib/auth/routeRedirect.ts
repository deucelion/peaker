import { getDefaultRouteForRole, ORG_LIFECYCLE_INFO_ROUTE, type UserRole } from "@/lib/auth/roleMatrix";
import { normalizePathname, SPORCU_DEFAULT_LANDING_ROUTE } from "@/lib/navigation/routeRegistry";

export type RouteRedirectReason =
  | "unauthenticated"
  | "forbidden_route"
  | "coach_permission_denied"
  | "athlete_permission_denied"
  | "feature_entitlement_denied"
  | "not_super_admin"
  | "same_path_guard";

export function pathsEqual(a: string, b: string): boolean {
  const norm = (p: string) => {
    if (!p) return "/";
    const trimmed = p.replace(/\/+$/, "") || "/";
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  };
  return norm(a) === norm(b);
}

/**
 * Aynı path'e tekrar redirect etme (Safari "çok fazla yönlendirme" döngüsünü keser).
 */
export function safeRedirectPath(currentPath: string, targetPath: string): string | null {
  if (pathsEqual(currentPath, targetPath)) return null;
  return targetPath;
}

/** Sporcu proxy: feature/permission deny sonrası `/sporcu` döngüsünü keser. */
export function resolveSporcuProxyFallbackRoute(currentPath: string): string | null {
  return safeRedirectPath(currentPath, SPORCU_DEFAULT_LANDING_ROUTE);
}

/** Admin/koç feature deny: önce parent path, yoksa rol varsayılanı. */
export function resolveManagementFeatureDenyFallback(
  currentPath: string,
  role: UserRole
): string | null {
  const normalized = normalizePathname(currentPath);
  const segments = normalized.split("/").filter(Boolean);
  if (segments.length > 1) {
    const parentPath = `/${segments.slice(0, -1).join("/")}`;
    const parentTarget = safeRedirectPath(currentPath, parentPath);
    if (parentTarget) {
      return parentTarget;
    }
  }
  return safeRedirectPath(currentPath, getDefaultRouteForRole(role));
}

export function fallbackRouteForDeniedAccess(role: UserRole | null): string {
  if (role) return getDefaultRouteForRole(role);
  return ORG_LIFECYCLE_INFO_ROUTE;
}

export function logRouteRedirectDecision(
  context: string,
  details: {
    pathname: string;
    role: UserRole | null;
    organizationId?: string | null;
    target: string | null;
    reason: RouteRedirectReason;
  }
): void {
  if (process.env.NODE_ENV === "production") return;
  console.info(`[route-redirect:${context}]`, {
    path: details.pathname,
    role: details.role,
    hasOrg: Boolean(details.organizationId),
    target: details.target,
    reason: details.reason,
  });
}
