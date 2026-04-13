import "server-only";

import { createServerSupabaseClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { isInactiveAdminProfile } from "@/lib/admin/lifecycle";
import { isInactiveAthleteProfile } from "@/lib/athlete/lifecycle";
import { evaluateOrganizationProductAccess } from "@/lib/auth/organizationGate";
import { isInactiveCoachProfile } from "@/lib/coach/lifecycle";
import { loadSessionProfileWithAdminFallback } from "@/lib/auth/loadSessionProfile";
import { getSafeRole, type UserRole } from "@/lib/auth/roleMatrix";
import { extractSessionFullName, extractSessionOrganizationId, extractSessionRole } from "@/lib/auth/sessionClaims";
import { mergeTenantProfileFromSources } from "@/lib/auth/tenantProfileMerge";
import type { OrganizationGateStatus } from "@/lib/organization/license";
import { toDisplayName } from "@/lib/profile/displayName";

export type MeRoleErrorCode =
  | "unauthorized"
  | "profile_fetch_failed"
  | "profile_missing"
  | "invalid_role"
  | "admin_inactive"
  | "coach_inactive"
  | "athlete_inactive"
  | "organization_blocked"
  | "unexpected_error";

export type MeRoleSuccess = {
  ok: true;
  role: UserRole;
  fullName: string;
  organizationId: string | null;
  organizationName: string | null;
  userId: string;
  email: string | null;
};

export type MeRoleFailure = {
  ok: false;
  httpStatus: 401 | 403 | 500;
  error: MeRoleErrorCode;
  /** Yalnizca error === "organization_blocked" */
  gateStatus?: OrganizationGateStatus;
};

export async function buildMeRolePayload(): Promise<MeRoleSuccess | MeRoleFailure> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { ok: false, httpStatus: 401, error: "unauthorized" };
    }

    const { profile, profileError } = await loadSessionProfileWithAdminFallback(user);

    const metaRole = extractSessionRole(user);
    const metaFullName = extractSessionFullName(user);
    const metaOrgId = extractSessionOrganizationId(user);
    const claimRole = getSafeRole(metaRole);
    const effectiveProfile =
      claimRole === "super_admin"
        ? {
            role: "super_admin" as const,
            full_name: profile?.full_name ?? metaFullName ?? "Super Admin",
            organization_id: null as string | null,
            is_active: true as const,
          }
        : mergeTenantProfileFromSources({
            profile,
            metaRole,
            metaFullName,
            metaOrgId,
          });

    if (profileError && !effectiveProfile?.role) {
      return { ok: false, httpStatus: 500, error: "profile_fetch_failed" };
    }

    if (!effectiveProfile?.role) {
      return { ok: false, httpStatus: 403, error: "profile_missing" };
    }

    const safeRole = getSafeRole(effectiveProfile.role);
    if (!safeRole) {
      return { ok: false, httpStatus: 403, error: "invalid_role" };
    }

    if (isInactiveAdminProfile(effectiveProfile.role, effectiveProfile.is_active)) {
      return { ok: false, httpStatus: 403, error: "admin_inactive" };
    }
    if (isInactiveCoachProfile(effectiveProfile.role, effectiveProfile.is_active)) {
      return { ok: false, httpStatus: 403, error: "coach_inactive" };
    }
    if (isInactiveAthleteProfile(effectiveProfile.role, effectiveProfile.is_active)) {
      return { ok: false, httpStatus: 403, error: "athlete_inactive" };
    }

    const organizationId = effectiveProfile.organization_id ?? null;

    if (safeRole !== "super_admin") {
      const gate = await evaluateOrganizationProductAccess(supabase, {
        role: effectiveProfile.role,
        organization_id: organizationId,
      });
      if (gate.blocked) {
        return {
          ok: false,
          httpStatus: 403,
          error: "organization_blocked",
          gateStatus: gate.status,
        };
      }
    }

    let organizationName: string | null = null;
    if (safeRole === "super_admin") {
      organizationName = "SYSTEM";
    } else if (organizationId) {
      try {
        const adminClient = createSupabaseAdminClient();
        const org = await adminClient.from("organizations").select("name").eq("id", organizationId).maybeSingle();
        organizationName = org.data?.name ?? null;
      } catch {
        organizationName = null;
      }
    }

    const fullName = toDisplayName(
      effectiveProfile.full_name ?? metaFullName ?? null,
      user.email ?? null,
      "Peaker User"
    );

    return {
      ok: true,
      role: safeRole,
      fullName,
      organizationId,
      organizationName,
      userId: user.id,
      email: user.email ?? null,
    };
  } catch {
    return { ok: false, httpStatus: 500, error: "unexpected_error" };
  }
}
