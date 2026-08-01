import type { BRANDING_SCHEMA_VERSION } from "./tokens";

export type BrandingAssetKind = "logo" | "mark" | "favicon";

export type BrandingColorTokenKey =
  | "primary"
  | "secondary"
  | "accent"
  | "background"
  | "surface"
  | "textPrimary"
  | "textSecondary"
  | "sidebarBackground"
  | "sidebarText"
  | "sidebarActive";

export type BrandingTextTokenKey = "appName" | "shortName";

export interface BrandingAssetReference {
  readonly assetId: string;
  readonly kind: BrandingAssetKind;
  readonly storagePath: string;
  readonly contentType: string;
  readonly updatedAt: string;
}

export interface BrandingTheme {
  readonly primary: string;
  readonly secondary: string;
  readonly accent: string;
  readonly background: string;
  readonly surface: string;
  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly sidebarBackground: string;
  readonly sidebarText: string;
  readonly sidebarActive: string;
}

export interface BrandingAssets {
  readonly logo: BrandingAssetReference;
  readonly mark: BrandingAssetReference;
  readonly favicon: BrandingAssetReference;
}

export interface BrandingApplication {
  readonly appName: string;
  readonly shortName: string;
}

export interface BrandingSidebar {
  readonly background: string;
  readonly text: string;
  readonly active: string;
}

export interface BrandingPdf {
  readonly title: string;
}

export interface BrandingEmail {
  readonly title: string;
}

export interface OrganizationBranding {
  readonly schemaVersion: typeof BRANDING_SCHEMA_VERSION;
  readonly brandingRevision: number;
  readonly theme: BrandingTheme;
  readonly assets: BrandingAssets;
  readonly application: BrandingApplication;
  readonly sidebar: BrandingSidebar;
  readonly pdf: BrandingPdf;
  readonly email: BrandingEmail;
}

export type ParseBrandingFailureReason = "invalid_payload" | "non_object" | "unsupported_schema";

export type ParseOrganizationBrandingResult =
  | { ok: true; branding: OrganizationBranding }
  | { ok: false; branding: OrganizationBranding; reason: ParseBrandingFailureReason };

export type ValidateBrandingResult = { ok: true } | { ok: false; errors: readonly string[] };
