import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import type { OrganizationBranding } from "@/lib/organization/branding/types";
import { resolveEmailBranding } from "@/lib/organization/branding/surfaces/resolveEmailBranding";
import { resolveFaviconBranding } from "@/lib/organization/branding/surfaces/resolveFaviconBranding";
import { resolveLogoBranding } from "@/lib/organization/branding/surfaces/resolveLogoBranding";
import { resolveMetadataBranding } from "@/lib/organization/branding/surfaces/resolveMetadataBranding";
import { resolvePdfBranding } from "@/lib/organization/branding/surfaces/resolvePdfBranding";
import { createFaviconBrandingModel, type FaviconBrandingModel } from "./faviconBrandingPresentation";
import { createLogoBrandingModel, type LogoBrandingModel } from "./logoBrandingModel";
import {
  createMetadataBrandingPresentation,
  type MetadataBrandingPresentation,
} from "./metadataBrandingPresentation";
import {
  createEmailBrandingPresentation,
  type EmailBrandingPresentation,
} from "./emailBrandingPresentation";
import { createPdfBrandingPresentation, type PdfBrandingPresentation } from "./pdfBrandingPresentation";

export type OrganizationBrandingPresentation = {
  logo: LogoBrandingModel;
  metadata: MetadataBrandingPresentation;
  favicon: FaviconBrandingModel;
  pdf: PdfBrandingPresentation;
  email: EmailBrandingPresentation;
};

export function createOrganizationBrandingPresentation(
  organizationBranding: OrganizationBranding | null | undefined
): OrganizationBrandingPresentation {
  const metadataSnapshot = resolveMetadataBranding(organizationBranding);
  return {
    logo: createLogoBrandingModel(resolveLogoBranding(organizationBranding), metadataSnapshot.shortName),
    metadata: createMetadataBrandingPresentation(metadataSnapshot),
    favicon: createFaviconBrandingModel(resolveFaviconBranding(organizationBranding)),
    pdf: createPdfBrandingPresentation(resolvePdfBranding(organizationBranding)),
    email: createEmailBrandingPresentation(resolveEmailBranding(organizationBranding)),
  };
}

export function createDefaultOrganizationBrandingPresentation(): OrganizationBrandingPresentation {
  return createOrganizationBrandingPresentation(createDefaultBranding());
}
