import { createClubProfessionalFeatures } from "../presets";

/**
 * Migration backfill ve yeni org default — Club Professional (tüm entitlement açık).
 * Tek kaynak: foundation presets ile aynı map.
 */
export const DEFAULT_ORGANIZATION_FEATURE_PRESET = "club_professional" as const;

export function createClubProfessionalFeaturesJson(): Record<string, boolean | number> {
  return { ...createClubProfessionalFeatures() };
}

/** Supabase migration / repository write için JSONB payload. */
export function serializeOrganizationFeaturesForPersistence(
  features: ReturnType<typeof createClubProfessionalFeatures>
): Record<string, boolean | number> {
  return { ...features };
}
