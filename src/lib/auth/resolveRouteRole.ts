import { getSafeRole, type UserRole } from "@/lib/auth/roleMatrix";
import { extractSessionRole } from "@/lib/auth/sessionClaims";
import type { User } from "@supabase/supabase-js";

/** DB / metadata'da farkli yazilmis super admin rollerini tanir. */
export function looksLikeSuperAdminRole(role: string | null | undefined): boolean {
  if (role == null || !String(role).trim()) return false;
  const normalized = String(role).trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  return normalized === "super_admin" || normalized === "superadmin" || /super[\s_-]?admin/i.test(role);
}

/**
 * Edge proxy ve sayfa guard'ları için rol çözümü.
 * JWT veya profil super_admin ise super_admin doner; aksi halde tenant rolune bakilir.
 */
export function resolveRouteRole(input: {
  profileRole?: string | null;
  sessionRole?: string | null;
}): UserRole | null {
  if (looksLikeSuperAdminRole(input.sessionRole) || looksLikeSuperAdminRole(input.profileRole)) {
    return "super_admin";
  }
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
