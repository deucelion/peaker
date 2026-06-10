import type { User } from "@supabase/supabase-js";

type AnyMeta = Record<string, unknown> | null | undefined;

function pickString(meta: AnyMeta, key: string): string | null {
  const v = meta?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function looksLikeSuperAdminClaim(role: string | null): boolean {
  if (!role) return false;
  const normalized = role.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  return normalized === "super_admin" || normalized === "superadmin" || /super[\s_-]?admin/i.test(role);
}

/**
 * FAZ 29: Session claim'i yalnızca tenant rolleri için kullanılabilir.
 * `user_metadata` client tarafından yazılabildiği için super_admin görünümlü
 * claim'ler burada null'a indirgenir; super_admin yetkisi her zaman
 * `profiles` tablosundaki rol ile kanıtlanmalıdır.
 */
export function extractSessionRole(user: User): string | null {
  const claim =
    pickString(user.user_metadata as AnyMeta, "role") || pickString(user.app_metadata as AnyMeta, "role");
  return looksLikeSuperAdminClaim(claim) ? null : claim;
}

export function extractSessionOrganizationId(user: User): string | null {
  return (
    pickString(user.user_metadata as AnyMeta, "organization_id") ||
    pickString(user.app_metadata as AnyMeta, "organization_id")
  );
}

export function extractSessionFullName(user: User): string | null {
  return (
    pickString(user.user_metadata as AnyMeta, "full_name") ||
    pickString(user.app_metadata as AnyMeta, "full_name")
  );
}
