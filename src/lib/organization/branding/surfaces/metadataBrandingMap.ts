import { BRANDING_CANONICAL_SECTION_REFS } from "./types";
import type { SurfaceBrandingMap } from "./types";

export const METADATA_SURFACE_IDS = {
  metadata: "surface:branding.metadata",
} as const;

export type MetadataSurfaceId = (typeof METADATA_SURFACE_IDS)[keyof typeof METADATA_SURFACE_IDS];

export const METADATA_BRANDING_MAP = {
  [METADATA_SURFACE_IDS.metadata]: BRANDING_CANONICAL_SECTION_REFS.application,
} as const satisfies SurfaceBrandingMap<MetadataSurfaceId>;
