import type { ConfigurableEntitlementKey, EntitlementKey, FeatureBundleParentKey } from "./types";

export const FEATURE_SCHEMA_VERSION = 1 as const;

/** Canonical entitlement key listesi — magic string yasak; tüm platform buradan türetilir. */
export const ENTITLEMENT_KEYS = {
  core: "core",
  athlete: "athlete",
  privateLessons: "private_lessons",
  finance: "finance",
  communications: "communications",
  audit: "audit",
  insightPerformance: "insight.performance",
  insightFieldTests: "insight.field_tests",
  insightBodyMeasurements: "insight.body_measurements",
  insightDevelopmentHub: "insight.development_hub",
  insightTrainingReports: "insight.training_reports",
  insightWellnessArchive: "insight.wellness_archive",
} as const satisfies Record<string, EntitlementKey>;

export const ALWAYS_ON_ENTITLEMENT_KEYS = [ENTITLEMENT_KEYS.core, ENTITLEMENT_KEYS.athlete] as const;

export const CONFIGURABLE_ENTITLEMENT_KEYS = [
  ENTITLEMENT_KEYS.privateLessons,
  ENTITLEMENT_KEYS.finance,
  ENTITLEMENT_KEYS.communications,
  ENTITLEMENT_KEYS.audit,
  ENTITLEMENT_KEYS.insightPerformance,
  ENTITLEMENT_KEYS.insightFieldTests,
  ENTITLEMENT_KEYS.insightBodyMeasurements,
  ENTITLEMENT_KEYS.insightDevelopmentHub,
  ENTITLEMENT_KEYS.insightTrainingReports,
  ENTITLEMENT_KEYS.insightWellnessArchive,
] as const satisfies readonly ConfigurableEntitlementKey[];

export const FEATURE_BUNDLE_PARENTS = {
  insight: "insight",
} as const satisfies Record<FeatureBundleParentKey, FeatureBundleParentKey>;

export const INSIGHT_BUNDLE_CHILD_KEYS = [
  ENTITLEMENT_KEYS.insightPerformance,
  ENTITLEMENT_KEYS.insightFieldTests,
  ENTITLEMENT_KEYS.insightBodyMeasurements,
  ENTITLEMENT_KEYS.insightDevelopmentHub,
  ENTITLEMENT_KEYS.insightTrainingReports,
  ENTITLEMENT_KEYS.insightWellnessArchive,
] as const;

export const FEATURE_BUNDLE_CHILD_KEYS: Readonly<Record<FeatureBundleParentKey, readonly EntitlementKey[]>> = {
  insight: INSIGHT_BUNDLE_CHILD_KEYS,
};

export const UI_BUNDLE_KEYS = [
  ENTITLEMENT_KEYS.privateLessons,
  ENTITLEMENT_KEYS.finance,
  FEATURE_BUNDLE_PARENTS.insight,
  ENTITLEMENT_KEYS.communications,
  ENTITLEMENT_KEYS.audit,
] as const;

export type UiBundleKey = (typeof UI_BUNDLE_KEYS)[number];

const CANONICAL_KEY_SET = new Set<string>([
  ...ALWAYS_ON_ENTITLEMENT_KEYS,
  ...CONFIGURABLE_ENTITLEMENT_KEYS,
]);

export function isCanonicalEntitlementKey(key: string): key is EntitlementKey {
  return CANONICAL_KEY_SET.has(key);
}

export function isAlwaysOnEntitlementKey(key: EntitlementKey): boolean {
  return key === ENTITLEMENT_KEYS.core || key === ENTITLEMENT_KEYS.athlete;
}

export function isFeatureBundleParentKey(key: string): key is FeatureBundleParentKey {
  return key === FEATURE_BUNDLE_PARENTS.insight;
}

export function isUiBundleKey(key: string): key is UiBundleKey {
  return (UI_BUNDLE_KEYS as readonly string[]).includes(key);
}

export function entitlementNamespace(key: EntitlementKey): string {
  const dot = key.indexOf(".");
  return dot === -1 ? key : key.slice(0, dot);
}
