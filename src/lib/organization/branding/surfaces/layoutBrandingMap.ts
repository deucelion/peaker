import { BRANDING_CANONICAL_SECTION_REFS } from "./types";
import type { SurfaceBrandingMap } from "./types";

export const LAYOUT_SURFACE_IDS = {
  layout: "surface:branding.layout",
} as const;

export type LayoutSurfaceId = (typeof LAYOUT_SURFACE_IDS)[keyof typeof LAYOUT_SURFACE_IDS];

export const LAYOUT_BRANDING_MAP = {
  [LAYOUT_SURFACE_IDS.layout]: BRANDING_CANONICAL_SECTION_REFS.theme,
} as const satisfies SurfaceBrandingMap<LayoutSurfaceId>;
