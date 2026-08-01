import { BRANDING_CANONICAL_SECTION_REFS } from "./types";
import type { SurfaceBrandingMap } from "./types";

export const SIDEBAR_SURFACE_IDS = {
  sidebar: "surface:branding.sidebar",
} as const;

export type SidebarSurfaceId = (typeof SIDEBAR_SURFACE_IDS)[keyof typeof SIDEBAR_SURFACE_IDS];

export const SIDEBAR_BRANDING_MAP = {
  [SIDEBAR_SURFACE_IDS.sidebar]: BRANDING_CANONICAL_SECTION_REFS.sidebar,
} as const satisfies SurfaceBrandingMap<SidebarSurfaceId>;
