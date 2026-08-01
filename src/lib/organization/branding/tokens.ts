import type { BrandingAssetKind, BrandingColorTokenKey, BrandingTextTokenKey } from "./types";

export const BRANDING_SCHEMA_VERSION = 1 as const;

/** Canonical color token anahtarlari — magic string yasak. */
export const BRANDING_COLOR_TOKEN_KEYS = {
  primary: "PRIMARY",
  secondary: "SECONDARY",
  accent: "ACCENT",
  background: "BACKGROUND",
  surface: "SURFACE",
  textPrimary: "TEXT_PRIMARY",
  textSecondary: "TEXT_SECONDARY",
  sidebarBackground: "SIDEBAR_BACKGROUND",
  sidebarText: "SIDEBAR_TEXT",
  sidebarActive: "SIDEBAR_ACTIVE",
} as const satisfies Record<BrandingColorTokenKey, string>;

export const BRANDING_COLOR_TOKEN_KEY_LIST = Object.keys(
  BRANDING_COLOR_TOKEN_KEYS
) as BrandingColorTokenKey[];

/** Canonical asset token anahtarlari. */
export const BRANDING_ASSET_TOKEN_KEYS = {
  logo: "LOGO",
  mark: "MARK",
  favicon: "FAVICON",
} as const;

export const BRANDING_ASSET_KINDS = {
  logo: "logo",
  mark: "mark",
  favicon: "favicon",
} as const satisfies Record<BrandingAssetKind, BrandingAssetKind>;

export const BRANDING_ASSET_KIND_LIST = Object.values(BRANDING_ASSET_KINDS);

/** Canonical text token anahtarlari. */
export const BRANDING_TEXT_TOKEN_KEYS = {
  appName: "APP_NAME",
  shortName: "SHORT_NAME",
} as const satisfies Record<BrandingTextTokenKey, string>;

export const BRANDING_TEXT_TOKEN_KEY_LIST = Object.keys(
  BRANDING_TEXT_TOKEN_KEYS
) as BrandingTextTokenKey[];

export const BRANDING_CANONICAL_TOKEN_KEYS = [
  ...Object.values(BRANDING_COLOR_TOKEN_KEYS),
  ...Object.values(BRANDING_ASSET_TOKEN_KEYS),
  ...Object.values(BRANDING_TEXT_TOKEN_KEYS),
] as const;

export type BrandingCanonicalTokenKey = (typeof BRANDING_CANONICAL_TOKEN_KEYS)[number];

export function isBrandingColorTokenKey(key: string): key is BrandingColorTokenKey {
  return key in BRANDING_COLOR_TOKEN_KEYS;
}

export function isBrandingAssetKind(value: string): value is BrandingAssetKind {
  return (BRANDING_ASSET_KIND_LIST as readonly string[]).includes(value);
}

export function isBrandingCanonicalTokenKey(key: string): key is BrandingCanonicalTokenKey {
  return (BRANDING_CANONICAL_TOKEN_KEYS as readonly string[]).includes(key);
}
