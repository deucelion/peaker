import type { FeatureOverrides, FeaturePresetId, OrganizationFeatures } from "../types";

/** Runtime read — yalnızca organizations.features + features_revision. */
export type OrganizationFeaturesRuntimeRow = {
  features: OrganizationFeatures;
  featuresRevision: number;
  /** Parser fail-closed veya normalize fallback kullanildi. */
  parseFallback?: boolean;
};

/** Write path / Super Admin — preset + override metadata (runtime okumaz). */
export type OrganizationFeatureConfigurationRow = OrganizationFeaturesRuntimeRow & {
  featurePreset: FeaturePresetId;
  featureOverrides: FeatureOverrides;
};

export type OrganizationFeaturesRepositoryErrorCode =
  | "not_found"
  | "read_failed"
  | "write_failed"
  | "revision_conflict"
  | "invalid_input";

export type OrganizationFeaturesRepositoryError = {
  ok: false;
  code: OrganizationFeaturesRepositoryErrorCode;
  message: string;
};

export type GetOrganizationFeaturesResult =
  | { ok: true; data: OrganizationFeaturesRuntimeRow }
  | OrganizationFeaturesRepositoryError;

export type SaveOrganizationFeatureConfigurationInput = {
  organizationId: string;
  preset: FeaturePresetId;
  overrides?: FeatureOverrides;
  /** Optimistic concurrency — verilirse eşleşmezse revision_conflict. */
  expectedRevision?: number;
};

export type SaveOrganizationFeatureConfigurationResult =
  | { ok: true; data: OrganizationFeatureConfigurationRow }
  | OrganizationFeaturesRepositoryError;

/**
 * Repository test ve ileriki fazlar için in-memory/Supabase adapter kontratı.
 * Supabase tipleri bu katmanın dışında kalır.
 */
export type OrganizationFeaturesPersistencePort = {
  readFeaturesRuntime(organizationId: string): Promise<
    | { ok: true; features: unknown; featuresRevision: number; parseFallback?: boolean }
    | { ok: false; message: string; notFound?: boolean }
  >;
  readFeaturesRevision(organizationId: string): Promise<
    | { ok: true; featuresRevision: number }
    | { ok: false; message: string; notFound?: boolean }
  >;
  writeFeatureConfiguration(input: {
    organizationId: string;
    featurePreset: FeaturePresetId;
    featureOverrides: FeatureOverrides;
    features: OrganizationFeatures;
    nextRevision: number;
    expectedRevision?: number;
  }): Promise<
    | { ok: true; featuresRevision: number }
    | { ok: false; message: string; revisionConflict?: boolean }
  >;
};
