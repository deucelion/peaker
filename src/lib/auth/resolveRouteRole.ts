import { getSafeRole, type UserRole } from "@/lib/auth/roleMatrix";
import { extractSessionRole } from "@/lib/auth/sessionClaims";
import type { User } from "@supabase/supabase-js";

/**
 * Edge proxy ve sayfa guard'ları için rol çözümü.
 * JWT `super_admin` claim'i profil satırındaki tenant rolünden önce gelir (me-role ile uyumlu).
 */
export function resolveRouteRole(input: {
  profileRole?: string | null;
  sessionRole?: string | null;
}): UserRole | null {
  const claim = getSafeRole(input.sessionRole);
  if (claim === "super_admin") return "super_admin";
  return getSafeRole(input.profileRole || input.sessionRole);
}

export function resolveRouteRoleFromUser(
  user: User,
  profileRole?: string | null
): UserRole | null {
  return resolveRouteRole({
    profileRole,
    sessionRole: extractSessionRole(user),
  });
}
