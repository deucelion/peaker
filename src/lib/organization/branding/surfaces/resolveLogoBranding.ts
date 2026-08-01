import { createDefaultBranding } from "../defaults";
import { BRANDING_ASSET_KINDS } from "../tokens";
import type { BrandingAssetReference, OrganizationBranding } from "../types";
import { LOGO_BRANDING_MAP, LOGO_SURFACE_IDS } from "./logoBrandingMap";
import { readBrandingAssetSection } from "./readBrandingAssetSection";
import type { BrandingCanonicalSectionRef } from "./types";

export type LogoBrandingSnapshot = {
  logo: BrandingAssetReference;
  sectionRef: BrandingCanonicalSectionRef;
  brandingRevision: number;
};

/**
 * Me-access organizationBranding snapshot'indan logo asset cozer.
 * Yalnizca LOGO_BRANDING_MAP uzerinden section secilir.
 */
export function resolveLogoBranding(
  organizationBranding: OrganizationBranding | null | undefined
): LogoBrandingSnapshot {
  try {
    const branding = organizationBranding ?? createDefaultBranding();
    const sectionRef = LOGO_BRANDING_MAP[LOGO_SURFACE_IDS.logo];
    return {
      logo: readBrandingAssetSection(branding, sectionRef, BRANDING_ASSET_KINDS.logo),
      sectionRef,
      brandingRevision: branding.brandingRevision,
    };
  } catch {
    const fallback = createDefaultBranding();
    return {
      logo: fallback.assets.logo,
      sectionRef: LOGO_BRANDING_MAP[LOGO_SURFACE_IDS.logo],
      brandingRevision: fallback.brandingRevision,
    };
  }
}
