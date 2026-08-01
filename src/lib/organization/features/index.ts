export type {
  EntitlementKey,
  FeatureCatalogEntry,
  FeatureCategory,
  FeatureOverrideKey,
  FeatureOverrides,
  FeaturePresetId,
  OrganizationFeatures,
  ParseFailureReason,
  ParseOrganizationFeaturesResult,
  RecomputeEffectiveInput,
  RecomputeEffectiveResult,
  SoftDependency,
  ValidateFeaturesResult,
} from "./types";

export { FEATURE_PRESET_IDS } from "./types";

export {
  ALWAYS_ON_ENTITLEMENT_KEYS,
  CONFIGURABLE_ENTITLEMENT_KEYS,
  ENTITLEMENT_KEYS,
  FEATURE_BUNDLE_CHILD_KEYS,
  FEATURE_BUNDLE_PARENTS,
  FEATURE_SCHEMA_VERSION,
  INSIGHT_BUNDLE_CHILD_KEYS,
  UI_BUNDLE_KEYS,
  entitlementNamespace,
  isAlwaysOnEntitlementKey,
  isCanonicalEntitlementKey,
  isFeatureBundleParentKey,
  isUiBundleKey,
} from "./keys";

export { MODULE_CATALOG, getCatalogEntry } from "./catalog";

export {
  PRESET_TEMPLATES,
  createClubProfessionalFeatures,
  getPresetTemplateFlat,
  isKnownFeaturePresetId,
} from "./presets";

export {
  buildOrganizationFeaturesFromConfigurable,
  cloneOrganizationFeatures,
  configurableSlice,
  isEntitlementEnabled,
} from "./helpers";

export {
  normalizeOrganizationFeatures,
  parseOrganizationFeatures,
  isOrganizationFeatures,
} from "./parser";

export { recomputeEffective, recomputeEffectiveFeatures } from "./recompute";

export {
  assertAlwaysOnEntitlements,
  applyOverrideToConfigurableMap,
  diffOverridesFromTemplate,
  stripUnknownFeatureKeys,
  validateEffectiveFeatures,
  validateOverrideKeys,
  validatePresetId,
} from "./validation";

export {
  DEFAULT_ORGANIZATION_FEATURE_PRESET,
  createClubProfessionalFeaturesJson,
  serializeOrganizationFeaturesForPersistence,
} from "./persistence/constants";

export type {
  GetOrganizationFeaturesResult,
  OrganizationFeatureConfigurationRow,
  OrganizationFeaturesRepositoryError,
  OrganizationFeaturesRepositoryErrorCode,
  OrganizationFeaturesRuntimeRow,
  SaveOrganizationFeatureConfigurationInput,
  SaveOrganizationFeatureConfigurationResult,
} from "./persistence/types";

export {
  createSupabaseOrganizationFeaturesPersistencePort,
  readOrganizationFeaturesPersistence,
  saveOrganizationFeatureConfiguration,
  saveOrganizationFeatureConfigurationFromAdminClient,
} from "./persistence/organizationFeaturesRepository";

export type { MeAccessOrganizationFeaturesPayload } from "./runtime/meAccessPayload";

export type {
  GetOrganizationFeaturesOptions,
  OrganizationFeaturesRuntimeResult,
  OrganizationFeaturesRuntimeSource,
  OrganizationFeaturesRuntimeSnapshot,
} from "./runtime/types";

export {
  getOrganizationFeatures,
  invalidateOrganizationFeaturesRuntimeCache,
  KILL_SWITCH_FEATURES_REVISION,
} from "./runtime/getOrganizationFeatures";

export { resolveOrganizationFeaturesForMeAccess } from "./runtime/meAccessPayload";

export { isOrganizationFeaturesRuntimeEnabled } from "./runtime/killSwitch";

export {
  emitOrganizationFeaturesRuntimeMetric,
  subscribeOrganizationFeaturesRuntimeMetrics,
} from "./runtime/metrics";

export { runWithOrganizationFeaturesRequestCacheAsync } from "./runtime/requestCache";

export type { SurfaceEntitlementMap } from "./surfaces/types";
export type { SurfaceMapContractIssue } from "./surfaces/contractValidation";

export {
  assertSurfaceMapContract,
  assertUniqueSurfaceMapKeys,
  collectSurfaceMapContractIssues,
  ACTION_NAMESPACE_ENTITLEMENT_MAP,
  ACTION_NAMESPACE_IDS,
  DASHBOARD_WIDGET_IDS,
  EXPORT_ENTITLEMENT_MAP,
  EXPORT_ENDPOINT_IDS,
  NAVIGATION_ENTITLEMENT_MAP,
  NAV_ITEM_IDS,
  OFFLINE_ENTITLEMENT_MAP,
  OFFLINE_KIND_IDS,
  QUICK_ACTION_ENTITLEMENT_MAP,
  QUICK_ACTION_IDS,
  REALTIME_ENTITLEMENT_MAP,
  REALTIME_SUBSCRIPTION_IDS,
  ROUTE_DYNAMIC_ENTITLEMENT_MAP,
  ROUTE_DYNAMIC_PATTERN_KEYS,
  ROUTE_DYNAMIC_PATTERN_PATHS,
  ROUTE_ENTITLEMENT_MAP,
  SNAPSHOT_BRANCH_IDS,
  SNAPSHOT_ENTITLEMENT_MAP,
  WIDGET_ENTITLEMENT_MAP,
  resolveRouteEntitlementKey,
} from "./surfaces";
