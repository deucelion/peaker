import type { PdfBrandingSnapshot } from "@/lib/organization/branding/surfaces/resolvePdfBranding";
import { resolvePdfBranding } from "@/lib/organization/branding/surfaces/resolvePdfBranding";
import type { OrganizationBranding } from "@/lib/organization/branding/types";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import { resolvePdfHeaderColorRgb, type PdfHeaderColorRgb } from "@/lib/pdf/pdfBrandingColors";

export type PdfBrandingPresentation = {
  title: string;
  headerColorRgb: PdfHeaderColorRgb;
};

export function createPdfBrandingPresentation(
  snapshot: PdfBrandingSnapshot,
  headerColorRgb: PdfHeaderColorRgb
): PdfBrandingPresentation {
  return {
    title: snapshot.title,
    headerColorRgb,
  };
}

export function createPdfBrandingPresentationFromOrganizationBranding(
  organizationBranding: OrganizationBranding | null | undefined
): PdfBrandingPresentation {
  const branding = organizationBranding ?? createDefaultBranding();
  return createPdfBrandingPresentation(
    resolvePdfBranding(organizationBranding),
    resolvePdfHeaderColorRgb(branding)
  );
}

export function createDefaultPdfBrandingPresentation(): PdfBrandingPresentation {
  return createPdfBrandingPresentationFromOrganizationBranding(createDefaultBranding());
}
