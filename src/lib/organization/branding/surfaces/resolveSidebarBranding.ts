import { createDefaultBranding } from "../defaults";
import type { BrandingSidebar, OrganizationBranding } from "../types";
import { SIDEBAR_BRANDING_MAP, SIDEBAR_SURFACE_IDS } from "./sidebarBrandingMap";
import { BRANDING_CANONICAL_SECTION_REFS, type BrandingCanonicalSectionRef } from "./types";

export type SidebarBrandingSnapshot = {
  sidebar: BrandingSidebar;
  sectionRef: BrandingCanonicalSectionRef;
  brandingRevision: number;
};

function isBrandingSidebar(value: unknown): value is BrandingSidebar {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "background" in value &&
    "text" in value &&
    "active" in value
  );
}

function readBrandingSidebarSection(
  branding: OrganizationBranding,
  sectionRef: BrandingCanonicalSectionRef
): BrandingSidebar {
  if (sectionRef === BRANDING_CANONICAL_SECTION_REFS.sidebar) {
    if (!isBrandingSidebar(branding.sidebar)) {
      throw new Error("Invalid sidebar branding section");
    }
    return branding.sidebar;
  }

  throw new Error(`Unsupported sidebar branding section: ${sectionRef}`);
}

/**
 * Me-access organizationBranding snapshot'indan sidebar section cozer.
 * Yalnizca SIDEBAR_BRANDING_MAP uzerinden section secilir.
 */
export function resolveSidebarBranding(
  organizationBranding: OrganizationBranding | null | undefined
): SidebarBrandingSnapshot {
  try {
    const branding = organizationBranding ?? createDefaultBranding();
    const sectionRef = SIDEBAR_BRANDING_MAP[SIDEBAR_SURFACE_IDS.sidebar];
    return {
      sidebar: readBrandingSidebarSection(branding, sectionRef),
      sectionRef,
      brandingRevision: branding.brandingRevision,
    };
  } catch {
    const fallback = createDefaultBranding();
    return {
      sidebar: fallback.sidebar,
      sectionRef: SIDEBAR_BRANDING_MAP[SIDEBAR_SURFACE_IDS.sidebar],
      brandingRevision: fallback.brandingRevision,
    };
  }
}
