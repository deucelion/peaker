import { createDefaultBranding } from "../defaults";
import type { BrandingTheme, OrganizationBranding } from "../types";
import { LAYOUT_BRANDING_MAP, LAYOUT_SURFACE_IDS } from "./layoutBrandingMap";
import { BRANDING_CANONICAL_SECTION_REFS, type BrandingCanonicalSectionRef } from "./types";

export type LayoutBrandingSnapshot = {
  theme: BrandingTheme;
  sectionRef: BrandingCanonicalSectionRef;
  brandingRevision: number;
};

function isBrandingTheme(value: unknown): value is BrandingTheme {
  return value !== null && typeof value === "object" && !Array.isArray(value) && "primary" in value;
}

function readBrandingThemeSection(
  branding: OrganizationBranding,
  sectionRef: BrandingCanonicalSectionRef
): BrandingTheme {
  if (sectionRef === BRANDING_CANONICAL_SECTION_REFS.theme) {
    if (!isBrandingTheme(branding.theme)) {
      throw new Error("Invalid layout branding theme section");
    }
    return branding.theme;
  }

  throw new Error(`Unsupported layout branding section: ${sectionRef}`);
}

/**
 * Me-access organizationBranding snapshot'indan layout theme cozer.
 * Yalnizca LAYOUT_BRANDING_MAP uzerinden section secilir.
 */
export function resolveLayoutBranding(
  organizationBranding: OrganizationBranding | null | undefined
): LayoutBrandingSnapshot {
  try {
    const branding = organizationBranding ?? createDefaultBranding();
    const sectionRef = LAYOUT_BRANDING_MAP[LAYOUT_SURFACE_IDS.layout];
    return {
      theme: readBrandingThemeSection(branding, sectionRef),
      sectionRef,
      brandingRevision: branding.brandingRevision,
    };
  } catch {
    const fallback = createDefaultBranding();
    return {
      theme: fallback.theme,
      sectionRef: LAYOUT_BRANDING_MAP[LAYOUT_SURFACE_IDS.layout],
      brandingRevision: fallback.brandingRevision,
    };
  }
}
