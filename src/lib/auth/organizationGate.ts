import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { isMissingOrganizationLifecycleColumnError } from "@/lib/organization/adminOrganizationQuery";
import {
  evaluateLicenseWindowBlock,
  normalizeOrganizationRowForGate,
  organizationGateStatusFromLicenseBlock,
  ORGANIZATION_ROW_UNAVAILABLE_STATUS,
  SCHEMA_INCOMPLETE_GATE_STATUS,
  NO_ORGANIZATION_GATE_STATUS,
  type OrganizationGateStatus,
} from "@/lib/organization/license";
import { orgStatusBlocksProductAccess } from "@/lib/organization/lifecycle";

export type OrgProductAccessResult =
  | { blocked: false }
  | { blocked: true; status: OrganizationGateStatus };

/**
 * Oturumlu kullanıcının organizasyonu ürün paneline erişebilir mi.
 *
 * Kalıcı model: `profiles.organization_id` yalnızca DB’den gelir (JWT ile RLS uyumu — tenantProfileMerge).
 * İlk okuma her zaman kullanıcı `supabase` istemcisiyle (RLS) yapılır; böylece normal yol anon key ile doğrulanır.
 *
 * Service role ikinci okuma: RLS politikası eski/uyumsuz deploy veya geçici tutarsızlıkta org satırı boş
 * dönse bile, aynı `organization_id` için yalnızca lifecycle alanları (`status`, `starts_at`, `ends_at`) okunur.
 * Üretimde `SUPABASE_SERVICE_ROLE_KEY` gerekir. Şema garantisi: `20260411_gate_rls_profiles_org_read_alignment.sql`.
 */
export async function evaluateOrganizationProductAccess(
  supabase: SupabaseClient,
  profile: { role: string | null | undefined; organization_id: string | null | undefined }
): Promise<OrgProductAccessResult> {
  if (getSafeRole(profile.role) === "super_admin") {
    return { blocked: false };
  }
  const orgId = profile.organization_id;
  if (!orgId) {
    return { blocked: true, status: NO_ORGANIZATION_GATE_STATUS };
  }

  let { data, error } = await supabase
    .from("organizations")
    .select("status, starts_at, ends_at")
    .eq("id", orgId)
    .maybeSingle();

  if (error && isMissingOrganizationLifecycleColumnError(error.message)) {
    return { blocked: true, status: SCHEMA_INCOMPLETE_GATE_STATUS };
  }

  if (error || !data) {
    try {
      const admin = createSupabaseAdminClient();
      const adminRes = await admin
        .from("organizations")
        .select("status, starts_at, ends_at")
        .eq("id", orgId)
        .maybeSingle();
      if (!adminRes.error && adminRes.data) {
        data = adminRes.data;
        error = null;
      }
    } catch {
      // SUPABASE_SERVICE_ROLE_KEY yok (vitest) veya admin istemcisi kurulamadi
    }
  }

  if (error || !data) {
    return { blocked: true, status: ORGANIZATION_ROW_UNAVAILABLE_STATUS };
  }

  const row = data as { status?: string | null; starts_at?: string | null; ends_at?: string | null };
  const { status, startsAt, endsAt } = normalizeOrganizationRowForGate(row);

  if (orgStatusBlocksProductAccess(status)) {
    return { blocked: true, status };
  }

  const licenseBlock = evaluateLicenseWindowBlock(status, startsAt, endsAt);
  if (licenseBlock) {
    return { blocked: true, status: organizationGateStatusFromLicenseBlock(licenseBlock) };
  }

  return { blocked: false };
}
