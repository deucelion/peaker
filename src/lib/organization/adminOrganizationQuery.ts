import type { SupabaseClient } from "@supabase/supabase-js";

export const ORG_ADMIN_SELECT_FULL = "id, name, created_at, status, starts_at, ends_at, updated_at";
export const ORG_ADMIN_SELECT_MINIMAL = "id, name, created_at";

export type AdminOrganizationRow = {
  id: string;
  name: string | null;
  created_at?: string | null;
  status?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  updated_at?: string | null;
};

/** PostgREST / Postgres / Supabase: lifecycle migration henüz uygulanmamış DB'leri algılar. */
export function isMissingOrganizationLifecycleColumnError(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  const missing =
    m.includes("does not exist") || m.includes("could not find") || m.includes("schema cache");
  if (!missing) return false;
  const lifecycleCol =
    m.includes("status") || m.includes("starts_at") || m.includes("ends_at") || m.includes("updated_at");
  if (!lifecycleCol) return false;
  return m.includes("organ") || m.includes("organizations");
}

export type FetchOrganizationByIdAdminResult = {
  data: AdminOrganizationRow | null;
  error: Error | null;
  /** false ise DB'de lifecycle kolonları yok (migration bekleniyor). */
  lifecycleColumnsPresent: boolean;
};

/**
 * Service role ile tek organizasyon; lifecycle kolonları yoksa minimal select + null alanlar.
 */
export async function fetchOrganizationByIdAdmin(
  adminClient: SupabaseClient,
  id: string
): Promise<FetchOrganizationByIdAdminResult> {
  const full = await adminClient.from("organizations").select(ORG_ADMIN_SELECT_FULL).eq("id", id).maybeSingle();

  if (!full.error && full.data) {
    return { data: full.data as AdminOrganizationRow, error: null, lifecycleColumnsPresent: true };
  }

  if (full.error && isMissingOrganizationLifecycleColumnError(full.error.message)) {
    const min = await adminClient.from("organizations").select(ORG_ADMIN_SELECT_MINIMAL).eq("id", id).maybeSingle();
    if (min.error) return { data: null, error: new Error(min.error.message), lifecycleColumnsPresent: false };
    if (!min.data) return { data: null, error: null, lifecycleColumnsPresent: false };
    const row = min.data as AdminOrganizationRow;
    return {
      data: {
        ...row,
        status: null,
        starts_at: null,
        ends_at: null,
        updated_at: null,
      },
      error: null,
      lifecycleColumnsPresent: false,
    };
  }

  if (full.error) return { data: null, error: new Error(full.error.message), lifecycleColumnsPresent: false };
  return { data: null, error: null, lifecycleColumnsPresent: false };
}
