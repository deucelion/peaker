import type { PdfBrandingSnapshot } from "@/lib/organization/branding/surfaces/resolvePdfBranding";
import { resolvePdfBranding } from "@/lib/organization/branding/surfaces/resolvePdfBranding";
import type { OrganizationBranding } from "@/lib/organization/branding/types";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";

export type PdfBrandingPresentation = {
  title: string;
};

export function createPdfBrandingPresentation(
  snapshot: PdfBrandingSnapshot
): PdfBrandingPresentation {
  return {
    title: snapshot.title,
  };
}

export function createPdfBrandingPresentationFromOrganizationBranding(
  organizationBranding: OrganizationBranding | null | undefined
): PdfBrandingPresentation {
  return createPdfBrandingPresentation(resolvePdfBranding(organizationBranding));
}

export function createDefaultPdfBrandingPresentation(): PdfBrandingPresentation {
  return createPdfBrandingPresentationFromOrganizationBranding(createDefaultBranding());
}
