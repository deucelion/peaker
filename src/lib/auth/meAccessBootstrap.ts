import type { UserRole } from "@/lib/auth/roleMatrix";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { getCoachPermissions } from "@/lib/auth/coachPermissions";
import { normalizeAthletePermissions } from "@/lib/auth/athletePermissions";
import { runWithOrganizationBrandingRequestCacheAsync } from "@/lib/organization/branding/runtime/requestCache";
import { resolveOrganizationBrandingForMeAccess } from "@/lib/organization/branding/runtime/brandingMeAccessPayload";
import { runWithOrganizationFeaturesRequestCacheAsync } from "@/lib/organization/features/runtime/requestCache";
import { resolveOrganizationFeaturesForMeAccess } from "@/lib/organization/features/runtime/meAccessPayload";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { OrganizationBranding } from "@/lib/organization/branding/types";
import type { OrganizationFeatures } from "@/lib/organization/features/types";
import type { AthletePermissionKey, AthletePermissions, CoachPermissions } from "@/lib/types";

export type MeAccessApiPayload = {
  role: UserRole;
  coachPermissions: CoachPermissions | null;
  athletePermissions: AthletePermissions | null;
  organizationFeatures: OrganizationFeatures;
  featuresRevision: number;
  organizationBranding: OrganizationBranding;
  brandingRevision: number;
};

export type MeAccessApiPayloadBase = Omit<
  MeAccessApiPayload,
  "organizationFeatures" | "featuresRevision" | "organizationBranding" | "brandingRevision"
>;

export type MeAccessApiError = {
  error: string;
  httpStatus: number;
};

export async function attachOrganizationFeaturesToMeAccessPayload(
  organizationId: string | null,
  base: MeAccessApiPayloadBase
): Promise<MeAccessApiPayload> {
  const [features, branding] = await Promise.all([
    resolveOrganizationFeaturesForMeAccess(organizationId ?? ""),
    resolveOrganizationBrandingForMeAccess(organizationId ?? ""),
  ]);
  return {
    ...base,
    organizationFeatures: features.organizationFeatures,
    featuresRevision: features.featuresRevision,
    organizationBranding: branding.organizationBranding,
    brandingRevision: branding.brandingRevision,
  };
}

export async function resolveMeAccessApiPayload(): Promise<MeAccessApiPayload | MeAccessApiError> {
  const resolved = await resolveSessionActor();
  if ("error" in resolved) {
    return { error: resolved.error, httpStatus: 401 };
  }

  const { actor } = resolved;
  const role = actor.role;
  const orgId = actor.organizationId;
  const adminClient = createSupabaseAdminClient();

  if (role === "coach" && orgId) {
    const coachPermissions = await getCoachPermissions(actor.id, orgId);
    return attachOrganizationFeaturesToMeAccessPayload(orgId, {
      role,
      coachPermissions,
      athletePermissions: null,
    });
  }

  if (role === "sporcu" && orgId) {
    const { data } = await adminClient
      .from("athlete_permissions")
      .select(
        "can_view_morning_report, can_view_programs, can_view_calendar, can_view_notifications, can_view_rpe_entry, can_view_development_profile, can_view_financial_status, can_view_performance_metrics, can_view_wellness_metrics, can_view_skill_radar"
      )
      .eq("athlete_id", actor.id)
      .eq("organization_id", orgId)
      .maybeSingle();

    return attachOrganizationFeaturesToMeAccessPayload(orgId, {
      role,
      coachPermissions: null,
      athletePermissions: normalizeAthletePermissions(
        (data as Partial<Record<AthletePermissionKey, boolean>> | null) || undefined
      ),
    });
  }

  return attachOrganizationFeaturesToMeAccessPayload(orgId, {
    role,
    coachPermissions: null,
    athletePermissions: null,
  });
}

export async function resolveMeAccessApiPayloadWithRequestCache(): Promise<
  MeAccessApiPayload | MeAccessApiError
> {
  return runWithOrganizationBrandingRequestCacheAsync(() =>
    runWithOrganizationFeaturesRequestCacheAsync(() => resolveMeAccessApiPayload())
  );
}
