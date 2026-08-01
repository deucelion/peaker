import { FEATURE_SCHEMA_VERSION } from "./keys";
import type { ConfigurableEntitlementKey, EntitlementKey, OrganizationFeatures } from "./types";

export function buildOrganizationFeaturesFromConfigurable(
  configurable: Record<ConfigurableEntitlementKey, boolean>
): OrganizationFeatures {
  return {
    schemaVersion: FEATURE_SCHEMA_VERSION,
    core: true,
    athlete: true,
    ...configurable,
  };
}

export function isEntitlementEnabled(
  features: OrganizationFeatures,
  key: EntitlementKey
): boolean {
  if (key === "core" || key === "athlete") {
    return true;
  }
  return Boolean(features[key]);
}

export function cloneOrganizationFeatures(features: OrganizationFeatures): OrganizationFeatures {
  return { ...features };
}

export function configurableSlice(
  features: OrganizationFeatures
): Record<ConfigurableEntitlementKey, boolean> {
  const {
    schemaVersion: _schemaVersion,
    core: _core,
    athlete: _athlete,
    ...configurable
  } = features;
  return configurable as Record<ConfigurableEntitlementKey, boolean>;
}
