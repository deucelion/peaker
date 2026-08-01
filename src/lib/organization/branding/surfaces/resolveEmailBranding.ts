import { createDefaultBranding } from "../defaults";
import type { BrandingEmail, OrganizationBranding } from "../types";
import { EMAIL_BRANDING_MAP, EMAIL_SURFACE_IDS } from "./emailBrandingMap";
import { BRANDING_CANONICAL_SECTION_REFS, type BrandingCanonicalSectionRef } from "./types";

export type EmailBrandingSnapshot = {
  title: string;
  sectionRef: BrandingCanonicalSectionRef;
  brandingRevision: number;
};

function isBrandingEmail(value: unknown): value is BrandingEmail {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as BrandingEmail).title === "string" &&
    (value as BrandingEmail).title.trim().length > 0
  );
}

function readBrandingEmailSection(
  branding: OrganizationBranding,
  sectionRef: BrandingCanonicalSectionRef
): BrandingEmail {
  if (sectionRef !== BRANDING_CANONICAL_SECTION_REFS.email) {
    throw new Error(`Unsupported email branding section: ${sectionRef}`);
  }

  if (!isBrandingEmail(branding.email)) {
    throw new Error("Invalid email branding section");
  }

  return branding.email;
}

/**
 * Me-access organizationBranding snapshot'indan email section cozer.
 * Yalnizca EMAIL_BRANDING_MAP uzerinden title okunur.
 */
export function resolveEmailBranding(
  organizationBranding: OrganizationBranding | null | undefined
): EmailBrandingSnapshot {
  try {
    const branding = organizationBranding ?? createDefaultBranding();
    const sectionRef = EMAIL_BRANDING_MAP[EMAIL_SURFACE_IDS.email];
    const email = readBrandingEmailSection(branding, sectionRef);

    return {
      title: email.title,
      sectionRef,
      brandingRevision: branding.brandingRevision,
    };
  } catch {
    const fallback = createDefaultBranding();
    return {
      title: fallback.email.title,
      sectionRef: EMAIL_BRANDING_MAP[EMAIL_SURFACE_IDS.email],
      brandingRevision: fallback.brandingRevision,
    };
  }
}
