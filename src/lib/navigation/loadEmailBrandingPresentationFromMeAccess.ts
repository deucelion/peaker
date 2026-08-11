"use client";

import {
  fetchMeAccessClient,
  readMeAccessClientCache,
  type MeAccessClientPayload,
} from "@/lib/auth/meAccessClient";
import {
  createDefaultEmailBrandingPresentation,
  createEmailBrandingPresentationFromOrganizationBranding,
  type EmailBrandingPresentation,
} from "@/lib/navigation/emailBrandingPresentation";

export async function loadEmailBrandingPresentationFromMeAccess(options?: {
  access?: MeAccessClientPayload;
}): Promise<EmailBrandingPresentation> {
  const access = options?.access ?? readMeAccessClientCache() ?? (await fetchMeAccessClient());
  if (!access.ok) {
    return createDefaultEmailBrandingPresentation();
  }

  return createEmailBrandingPresentationFromOrganizationBranding(access.organizationBranding);
}
