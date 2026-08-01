import { BRANDING_CANONICAL_SECTION_REFS } from "./types";
import type { SurfaceBrandingMap } from "./types";

export const FAVICON_SURFACE_IDS = {
  favicon: "surface:branding.favicon",
} as const;

export type FaviconSurfaceId = (typeof FAVICON_SURFACE_IDS)[keyof typeof FAVICON_SURFACE_IDS];

export const FAVICON_BRANDING_MAP = {
  [FAVICON_SURFACE_IDS.favicon]: BRANDING_CANONICAL_SECTION_REFS.assetsFavicon,
} as const satisfies SurfaceBrandingMap<FaviconSurfaceId>;
