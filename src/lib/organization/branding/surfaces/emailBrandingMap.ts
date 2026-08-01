import { BRANDING_CANONICAL_SECTION_REFS } from "./types";
import type { SurfaceBrandingMap } from "./types";

export const EMAIL_SURFACE_IDS = {
  email: "surface:branding.email",
} as const;

export type EmailSurfaceId = (typeof EMAIL_SURFACE_IDS)[keyof typeof EMAIL_SURFACE_IDS];

export const EMAIL_BRANDING_MAP = {
  [EMAIL_SURFACE_IDS.email]: BRANDING_CANONICAL_SECTION_REFS.email,
} as const satisfies SurfaceBrandingMap<EmailSurfaceId>;
