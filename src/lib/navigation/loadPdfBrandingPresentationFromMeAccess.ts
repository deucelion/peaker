"use client";

import { fetchMeAccessClient } from "@/lib/auth/meAccessClient";
import {
  createDefaultPdfBrandingPresentation,
  createPdfBrandingPresentationFromOrganizationBranding,
  type PdfBrandingPresentation,
} from "@/lib/navigation/pdfBrandingPresentation";

export async function loadPdfBrandingPresentationFromMeAccess(): Promise<PdfBrandingPresentation> {
  const access = await fetchMeAccessClient();
  if (!access.ok) {
    return createDefaultPdfBrandingPresentation();
  }

  return createPdfBrandingPresentationFromOrganizationBranding(access.organizationBranding);
}
