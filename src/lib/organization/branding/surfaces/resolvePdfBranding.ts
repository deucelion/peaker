import { createDefaultBranding } from "../defaults";
import type { BrandingPdf, OrganizationBranding } from "../types";
import { PDF_BRANDING_MAP, PDF_SURFACE_IDS } from "./pdfBrandingMap";
import { BRANDING_CANONICAL_SECTION_REFS, type BrandingCanonicalSectionRef } from "./types";

export type PdfBrandingSnapshot = {
  title: string;
  sectionRef: BrandingCanonicalSectionRef;
  brandingRevision: number;
};

function isBrandingPdf(value: unknown): value is BrandingPdf {
  return Boolean(value) && typeof value === "object" && typeof (value as BrandingPdf).title === "string" && (value as BrandingPdf).title.trim().length > 0;
}

function readBrandingPdfSection(
  branding: OrganizationBranding,
  sectionRef: BrandingCanonicalSectionRef
): BrandingPdf {
  if (sectionRef !== BRANDING_CANONICAL_SECTION_REFS.pdf) {
    throw new Error(`Unsupported pdf branding section: ${sectionRef}`);
  }

  if (!isBrandingPdf(branding.pdf)) {
    throw new Error("Invalid pdf branding section");
  }

  return branding.pdf;
}

/**
 * Me-access organizationBranding snapshot'indan pdf section cozer.
 * Yalnizca PDF_BRANDING_MAP uzerinden title okunur.
 */
export function resolvePdfBranding(
  organizationBranding: OrganizationBranding | null | undefined
): PdfBrandingSnapshot {
  try {
    const branding = organizationBranding ?? createDefaultBranding();
    const sectionRef = PDF_BRANDING_MAP[PDF_SURFACE_IDS.pdf];
    const pdf = readBrandingPdfSection(branding, sectionRef);

    return {
      title: pdf.title,
      sectionRef,
      brandingRevision: branding.brandingRevision,
    };
  } catch {
    const fallback = createDefaultBranding();
    return {
      title: fallback.pdf.title,
      sectionRef: PDF_BRANDING_MAP[PDF_SURFACE_IDS.pdf],
      brandingRevision: fallback.brandingRevision,
    };
  }
}
