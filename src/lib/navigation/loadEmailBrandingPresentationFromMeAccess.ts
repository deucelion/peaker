"use client";

import { fetchMeAccessClient } from "@/lib/auth/meAccessClient";
import {
  createDefaultEmailBrandingPresentation,
  createEmailBrandingPresentationFromOrganizationBranding,
  type EmailBrandingPresentation,
} from "@/lib/navigation/emailBrandingPresentation";

export async function loadEmailBrandingPresentationFromMeAccess(): Promise<EmailBrandingPresentation> {
  const access = await fetchMeAccessClient();
  if (!access.ok) {
    return createDefaultEmailBrandingPresentation();
  }

  return createEmailBrandingPresentationFromOrganizationBranding(access.organizationBranding);
}
