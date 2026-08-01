import type { EmailBrandingSnapshot } from "@/lib/organization/branding/surfaces/resolveEmailBranding";
import { resolveEmailBranding } from "@/lib/organization/branding/surfaces/resolveEmailBranding";
import type { OrganizationBranding } from "@/lib/organization/branding/types";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";

export type EmailBrandingPresentation = {
  title: string;
};

export function createEmailBrandingPresentation(
  snapshot: EmailBrandingSnapshot
): EmailBrandingPresentation {
  return {
    title: snapshot.title,
  };
}

export function createEmailBrandingPresentationFromOrganizationBranding(
  organizationBranding: OrganizationBranding | null | undefined
): EmailBrandingPresentation {
  return createEmailBrandingPresentation(resolveEmailBranding(organizationBranding));
}

export function createDefaultEmailBrandingPresentation(): EmailBrandingPresentation {
  return createEmailBrandingPresentationFromOrganizationBranding(createDefaultBranding());
}
