import { createDefaultBranding } from "../defaults";
import { BRANDING_ASSET_KINDS } from "../tokens";
import type { BrandingAssetReference, OrganizationBranding } from "../types";
import { FAVICON_BRANDING_MAP, FAVICON_SURFACE_IDS } from "./faviconBrandingMap";
import { readBrandingAssetSection } from "./readBrandingAssetSection";
import type { BrandingCanonicalSectionRef } from "./types";

export type FaviconBrandingSnapshot = {
  favicon: BrandingAssetReference;
  sectionRef: BrandingCanonicalSectionRef;
  brandingRevision: number;
};

/**
 * Me-access organizationBranding snapshot'indan favicon asset cozer.
 * Yalnizca FAVICON_BRANDING_MAP uzerinden section secilir.
 */
export function resolveFaviconBranding(
  organizationBranding: OrganizationBranding | null | undefined
): FaviconBrandingSnapshot {
  try {
    const branding = organizationBranding ?? createDefaultBranding();
    const sectionRef = FAVICON_BRANDING_MAP[FAVICON_SURFACE_IDS.favicon];
    return {
      favicon: readBrandingAssetSection(branding, sectionRef, BRANDING_ASSET_KINDS.favicon),
      sectionRef,
      brandingRevision: branding.brandingRevision,
    };
  } catch {
    const fallback = createDefaultBranding();
    return {
      favicon: fallback.assets.favicon,
      sectionRef: FAVICON_BRANDING_MAP[FAVICON_SURFACE_IDS.favicon],
      brandingRevision: fallback.brandingRevision,
    };
  }
}
