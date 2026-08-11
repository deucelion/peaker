"use client";

import {
  fetchMeAccessClient,
  readMeAccessClientCache,
  type MeAccessClientPayload,
} from "@/lib/auth/meAccessClient";
import {
  createDefaultPdfBrandingPresentation,
  createPdfBrandingPresentationFromOrganizationBranding,
  type PdfBrandingPresentation,
} from "@/lib/navigation/pdfBrandingPresentation";

export async function loadPdfBrandingPresentationFromMeAccess(options?: {
  access?: MeAccessClientPayload;
}): Promise<PdfBrandingPresentation> {
  const access = options?.access ?? readMeAccessClientCache() ?? (await fetchMeAccessClient());
  if (!access.ok) {
    return createDefaultPdfBrandingPresentation();
  }

  return createPdfBrandingPresentationFromOrganizationBranding(access.organizationBranding);
}
