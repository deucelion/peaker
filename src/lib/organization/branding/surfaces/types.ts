import type { BrandingAssetKind } from "../types";
import { BRANDING_ASSET_KINDS } from "../tokens";

/** Canonical OrganizationBranding ust seviye section path sabitleri. */
export const BRANDING_SECTION_PATHS = {
  theme: "theme",
  assets: "assets",
  application: "application",
  sidebar: "sidebar",
  pdf: "pdf",
  email: "email",
} as const;

export type BrandingTopLevelSectionPath =
  (typeof BRANDING_SECTION_PATHS)[keyof typeof BRANDING_SECTION_PATHS];

/** Canonical asset alt path sabitleri — BRANDING_ASSET_KINDS ile hizali. */
export const BRANDING_ASSET_SECTION_PATHS = {
  logo: BRANDING_ASSET_KINDS.logo,
  mark: BRANDING_ASSET_KINDS.mark,
  favicon: BRANDING_ASSET_KINDS.favicon,
} as const satisfies Record<BrandingAssetKind, BrandingAssetKind>;

export type BrandingAssetSectionPath =
  (typeof BRANDING_ASSET_SECTION_PATHS)[keyof typeof BRANDING_ASSET_SECTION_PATHS];

export type BrandingNestedAssetSectionRef =
  `${typeof BRANDING_SECTION_PATHS.assets}.${BrandingAssetSectionPath}`;

/** Surface map degerleri yalnizca canonical branding section ref olabilir. */
export type BrandingCanonicalSectionRef =
  | typeof BRANDING_SECTION_PATHS.theme
  | typeof BRANDING_SECTION_PATHS.sidebar
  | typeof BRANDING_SECTION_PATHS.application
  | typeof BRANDING_SECTION_PATHS.pdf
  | typeof BRANDING_SECTION_PATHS.email
  | BrandingNestedAssetSectionRef;

export const BRANDING_CANONICAL_SECTION_REFS = {
  theme: BRANDING_SECTION_PATHS.theme,
  sidebar: BRANDING_SECTION_PATHS.sidebar,
  application: BRANDING_SECTION_PATHS.application,
  pdf: BRANDING_SECTION_PATHS.pdf,
  email: BRANDING_SECTION_PATHS.email,
  assetsLogo: `${BRANDING_SECTION_PATHS.assets}.${BRANDING_ASSET_SECTION_PATHS.logo}` as BrandingNestedAssetSectionRef,
  assetsMark: `${BRANDING_SECTION_PATHS.assets}.${BRANDING_ASSET_SECTION_PATHS.mark}` as BrandingNestedAssetSectionRef,
  assetsFavicon: `${BRANDING_SECTION_PATHS.assets}.${BRANDING_ASSET_SECTION_PATHS.favicon}` as BrandingNestedAssetSectionRef,
} as const satisfies Record<string, BrandingCanonicalSectionRef>;

export const BRANDING_CANONICAL_SECTION_REF_LIST = Object.values(
  BRANDING_CANONICAL_SECTION_REFS
) as readonly BrandingCanonicalSectionRef[];

/** Surface map degerleri yalnizca canonical branding section ref olabilir. */
export type SurfaceBrandingMap<TKey extends string> = Readonly<
  Record<TKey, BrandingCanonicalSectionRef>
>;

export const BRANDING_SURFACE_KINDS = {
  layout: "LAYOUT",
  sidebar: "SIDEBAR",
  logo: "LOGO",
  favicon: "FAVICON",
  pdf: "PDF",
  email: "EMAIL",
  metadata: "METADATA",
} as const;

export type BrandingSurfaceKind = keyof typeof BRANDING_SURFACE_KINDS;
