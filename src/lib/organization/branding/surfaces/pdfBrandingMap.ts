import { BRANDING_CANONICAL_SECTION_REFS } from "./types";
import type { SurfaceBrandingMap } from "./types";

export const PDF_SURFACE_IDS = {
  pdf: "surface:branding.pdf",
} as const;

export type PdfSurfaceId = (typeof PDF_SURFACE_IDS)[keyof typeof PDF_SURFACE_IDS];

export const PDF_BRANDING_MAP = {
  [PDF_SURFACE_IDS.pdf]: BRANDING_CANONICAL_SECTION_REFS.pdf,
} as const satisfies SurfaceBrandingMap<PdfSurfaceId>;
