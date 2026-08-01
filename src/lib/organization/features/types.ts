import type { FEATURE_SCHEMA_VERSION } from "./keys";

/** Satış / Super Admin preset kimlikleri — yalnızca kod; runtime okumaz. */
export const FEATURE_PRESET_IDS = [
  "academy_lite",
  "academy_plus",
  "club_professional",
  "club_enterprise",
  "custom",
] as const;

export type FeaturePresetId = (typeof FEATURE_PRESET_IDS)[number];

export const FEATURE_CATEGORIES = [
  "platform",
  "athlete_experience",
  "revenue",
  "analytics",
  "communications",
  "governance",
] as const;

export type FeatureCategory = (typeof FEATURE_CATEGORIES)[number];

export type SoftDependency = {
  key: EntitlementKey;
  type: "soft";
  messageTr: string;
};

/** Runtime flat entitlement anahtarı (namespace destekli). */
export type EntitlementKey =
  | "core"
  | "athlete"
  | "private_lessons"
  | "finance"
  | "communications"
  | "audit"
  | "insight.performance"
  | "insight.field_tests"
  | "insight.body_measurements"
  | "insight.development_hub"
  | "insight.training_reports"
  | "insight.wellness_archive";

/** v1 UI bundle parent — effective map'te saklanmaz; override/recompute girdisi. */
export type FeatureBundleParentKey = "insight";

export type FeatureOverrideKey = EntitlementKey | FeatureBundleParentKey;

export type ConfigurableEntitlementKey = Exclude<EntitlementKey, "core" | "athlete">;

export type FeatureCatalogEntry = {
  key: EntitlementKey;
  label: string;
  category: FeatureCategory;
  alwaysOn: boolean;
  /** UI bundle parent; yalnızca child key'ler için dolu. */
  bundleParent: FeatureBundleParentKey | null;
  schemaVersion: typeof FEATURE_SCHEMA_VERSION;
  dependsOn?: readonly SoftDependency[];
};

export type OrganizationFeatures = {
  schemaVersion: typeof FEATURE_SCHEMA_VERSION;
  core: true;
  athlete: true;
} & Record<ConfigurableEntitlementKey, boolean>;

export type FeatureOverrides = Partial<Record<FeatureOverrideKey, boolean>>;

export type RecomputeEffectiveInput = {
  preset: FeaturePresetId;
  overrides?: FeatureOverrides;
};

export type RecomputeEffectiveResult =
  | { ok: true; features: OrganizationFeatures; overrides: FeatureOverrides }
  | { ok: false; errors: readonly string[] };

export type ParseOrganizationFeaturesResult =
  | { ok: true; features: OrganizationFeatures }
  | { ok: false; features: OrganizationFeatures; reason: ParseFailureReason };

export type ParseFailureReason = "invalid_payload" | "non_object";

export type ValidateFeaturesResult = { ok: true } | { ok: false; errors: readonly string[] };
