import type { MetadataBrandingSnapshot } from "@/lib/organization/branding/surfaces/resolveMetadataBranding";

export const METADATA_PAGE_TITLE_SUFFIX = "Performance Lab" as const;

export type MetadataBrandingPresentation = {
  appName: string;
  shortName: string;
  pageTitle: string;
  manifestTitle: string;
  openGraphTitle: string;
};

export function createMetadataBrandingPresentation(
  snapshot: MetadataBrandingSnapshot
): MetadataBrandingPresentation {
  return {
    appName: snapshot.appName,
    shortName: snapshot.shortName,
    pageTitle: `${snapshot.appName} | ${METADATA_PAGE_TITLE_SUFFIX}`,
    manifestTitle: snapshot.appName,
    openGraphTitle: snapshot.appName,
  };
}
