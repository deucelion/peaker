import { getDefaultRouteForRole, ORG_LIFECYCLE_INFO_ROUTE, type UserRole } from "@/lib/auth/roleMatrix";

export type RouteRedirectReason =
  | "unauthenticated"
  | "forbidden_route"
  | "coach_permission_denied"
  | "athlete_permission_denied"
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
