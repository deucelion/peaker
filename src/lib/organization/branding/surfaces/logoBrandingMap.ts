import { BRANDING_CANONICAL_SECTION_REFS } from "./types";
import type { SurfaceBrandingMap } from "./types";

export const LOGO_SURFACE_IDS = {
  logo: "surface:branding.logo",
} as const;

export type LogoSurfaceId = (typeof LOGO_SURFACE_IDS)[keyof typeof LOGO_SURFACE_IDS];

export const LOGO_BRANDING_MAP = {
  [LOGO_SURFACE_IDS.logo]: BRANDING_CANONICAL_SECTION_REFS.assetsLogo,
} as const satisfies SurfaceBrandingMap<LogoSurfaceId>;
