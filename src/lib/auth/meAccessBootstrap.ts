import type { UserRole } from "@/lib/auth/roleMatrix";
import { resolveOrganizationBrandingForMeAccess } from "@/lib/organization/branding/runtime/brandingMeAccessPayload";
import { resolveOrganizationFeaturesForMeAccess } from "@/lib/organization/features/runtime/meAccessPayload";
import type { OrganizationBranding } from "@/lib/organization/branding/types";
import type { OrganizationFeatures } from "@/lib/organization/features/types";
import type { AthletePermissions, CoachPermissions } from "@/lib/types";

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
