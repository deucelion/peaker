import { createDefaultBranding } from "../defaults";
import type { OrganizationBranding } from "../types";

/**
 * Migration backfill ve yeni org default — Peaker platform branding.
 * Tek kaynak: foundation createDefaultBranding ile ayni model.
 */
export const DEFAULT_BRANDING: OrganizationBranding = createDefaultBranding();

/** Supabase migration / repository write icin JSONB payload. */
export function createDefaultBrandingJson(): Record<string, unknown> {
  return serializeBranding(createDefaultBranding());
}

export function serializeBranding(branding: OrganizationBranding): Record<string, unknown> {
  return {
    schemaVersion: branding.schemaVersion,
    brandingRevision: branding.brandingRevision,
    theme: { ...branding.theme },
    assets: {
      logo: { ...branding.assets.logo },
      mark: { ...branding.assets.mark },
      favicon: { ...branding.assets.favicon },
    },
    application: { ...branding.application },
    sidebar: { ...branding.sidebar },
    pdf: { ...branding.pdf },
    email: { ...branding.email },
  };
}
