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
 *
 * FAZ 29 güvenlik kuralı: super_admin yalnızca DB'deki profil rolünden türetilir.
 * `user_metadata` client tarafından yazılabildiği için JWT claim'i super_admin'e
 * yükseltme yapamaz; claim yalnızca tenant rolleri (admin/coach/sporcu) için
 * profil eksikken fallback olarak kullanılır.
 */
export function resolveRouteRole(input: {
  profileRole?: string | null;
  sessionRole?: string | null;
}): UserRole | null {
  if (looksLikeSuperAdminRole(input.profileRole)) return "super_admin";
  const profileSafe = getSafeRole(input.profileRole);
  if (profileSafe) return profileSafe;
  // Claim fallback: super_admin claim'i güvenilmezdir, yok sayılır.
  if (looksLikeSuperAdminRole(input.sessionRole)) return null;
  const sessionSafe = getSafeRole(input.sessionRole);
  return sessionSafe === "super_admin" ? null : sessionSafe;
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
