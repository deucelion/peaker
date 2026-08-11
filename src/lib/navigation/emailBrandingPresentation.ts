import type { EmailBrandingSnapshot } from "@/lib/organization/branding/surfaces/resolveEmailBranding";
import { resolveEmailBranding } from "@/lib/organization/branding/surfaces/resolveEmailBranding";
import type { OrganizationBranding } from "@/lib/organization/branding/types";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";

export type EmailBrandingPresentation = {
  title: string;
  headerColor: string;
};

export function createEmailBrandingPresentation(
  snapshot: EmailBrandingSnapshot,
  headerColor: string
): EmailBrandingPresentation {
  return {
    title: snapshot.title,
    headerColor,
  };
}

export function createEmailBrandingPresentationFromOrganizationBranding(
  organizationBranding: OrganizationBranding | null | undefined
): EmailBrandingPresentation {
  const branding = organizationBranding ?? createDefaultBranding();
  return createEmailBrandingPresentation(resolveEmailBranding(organizationBranding), branding.theme.primary);
}

export function createDefaultEmailBrandingPresentation(): EmailBrandingPresentation {
  return createEmailBrandingPresentationFromOrganizationBranding(createDefaultBranding());
}
