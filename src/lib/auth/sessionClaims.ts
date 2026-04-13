import type { User } from "@supabase/supabase-js";

type AnyMeta = Record<string, unknown> | null | undefined;

function pickString(meta: AnyMeta, key: string): string | null {
  const v = meta?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function extractSessionRole(user: User): string | null {
  return pickString(user.user_metadata as AnyMeta, "role") || pickString(user.app_metadata as AnyMeta, "role");
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
