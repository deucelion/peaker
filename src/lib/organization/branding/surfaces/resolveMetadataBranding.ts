import { createDefaultBranding } from "../defaults";
import type { BrandingApplication, OrganizationBranding } from "../types";
import { METADATA_BRANDING_MAP, METADATA_SURFACE_IDS } from "./metadataBrandingMap";
import { BRANDING_CANONICAL_SECTION_REFS, type BrandingCanonicalSectionRef } from "./types";

export type MetadataBrandingSnapshot = {
  appName: string;
  shortName: string;
  sectionRef: BrandingCanonicalSectionRef;
  brandingRevision: number;
};

function isBrandingApplication(value: unknown): value is BrandingApplication {
  if (!value || typeof value !== "object") {
    return false;
  }

  const application = value as Partial<BrandingApplication>;
  return (
    typeof application.appName === "string" &&
    application.appName.trim().length > 0 &&
    typeof application.shortName === "string" &&
    application.shortName.trim().length > 0
  );
}

function readBrandingApplicationSection(
  branding: OrganizationBranding,
  sectionRef: BrandingCanonicalSectionRef
): BrandingApplication {
  if (sectionRef !== BRANDING_CANONICAL_SECTION_REFS.application) {
    throw new Error(`Unsupported metadata branding section: ${sectionRef}`);
  }

  if (!isBrandingApplication(branding.application)) {
    throw new Error("Invalid metadata branding application section");
  }

  return branding.application;
}

/**
 * Me-access organizationBranding snapshot'indan application metadata cozer.
 * Yalnizca METADATA_BRANDING_MAP uzerinden appName ve shortName okunur.
 */
export function resolveMetadataBranding(
  organizationBranding: OrganizationBranding | null | undefined
): MetadataBrandingSnapshot {
  try {
    const branding = organizationBranding ?? createDefaultBranding();
    const sectionRef = METADATA_BRANDING_MAP[METADATA_SURFACE_IDS.metadata];
    const application = readBrandingApplicationSection(branding, sectionRef);

    return {
      appName: application.appName,
      shortName: application.shortName,
      sectionRef,
      brandingRevision: branding.brandingRevision,
    };
  } catch {
    const fallback = createDefaultBranding();
    return {
      appName: fallback.application.appName,
      shortName: fallback.application.shortName,
      sectionRef: METADATA_BRANDING_MAP[METADATA_SURFACE_IDS.metadata],
      brandingRevision: fallback.brandingRevision,
    };
  }
}
