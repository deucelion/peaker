import { BRANDING_ASSET_KINDS, BRANDING_SCHEMA_VERSION } from "./tokens";
import type { BrandingAssetReference, OrganizationBranding } from "./types";

const DEFAULT_BRANDING_UPDATED_AT = "2026-01-01T00:00:00.000Z" as const;

function defaultAssetReference(
  assetId: string,
  kind: BrandingAssetReference["kind"],
  storagePath: string,
  contentType: string
): BrandingAssetReference {
  return {
    assetId,
    kind,
    storagePath,
    contentType,
    updatedAt: DEFAULT_BRANDING_UPDATED_AT,
  };
}

/** Peaker platform default branding — tek kaynak. */
export function createDefaultBranding(): OrganizationBranding {
  return {
    schemaVersion: BRANDING_SCHEMA_VERSION,
    brandingRevision: 0,
    theme: {
      primary: "#7c3aed",
      secondary: "#5b21b6",
      accent: "#7c3aed",
      background: "#09090b",
      surface: "#121215",
      textPrimary: "#ffffff",
      textSecondary: "#a1a1aa",
      sidebarBackground: "#09090b",
      sidebarText: "#71717a",
      sidebarActive: "#ffffff",
    },
    assets: {
      logo: defaultAssetReference(
        "peaker-default-logo",
        BRANDING_ASSET_KINDS.logo,
        "branding/defaults/logo.svg",
        "image/svg+xml"
      ),
      mark: defaultAssetReference(
        "peaker-default-mark",
        BRANDING_ASSET_KINDS.mark,
        "branding/defaults/mark.svg",
        "image/svg+xml"
      ),
      favicon: defaultAssetReference(
        "peaker-default-favicon",
        BRANDING_ASSET_KINDS.favicon,
        "branding/defaults/favicon.ico",
        "image/x-icon"
      ),
    },
    application: {
      appName: "PEAKER",
      shortName: "Peaker",
    },
    sidebar: {
      background: "#09090b",
      text: "#71717a",
      active: "#ffffff",
    },
    pdf: {
      title: "PEAKER Rapor",
    },
    email: {
      title: "PEAKER",
    },
  };
}
