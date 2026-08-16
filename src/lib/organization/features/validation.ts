import {
  CONFIGURABLE_ENTITLEMENT_KEYS,
  FEATURE_BUNDLE_CHILD_KEYS,
  isAlwaysOnEntitlementKey,
  isCanonicalEntitlementKey,
  isFeatureBundleParentKey,
} from "./keys";
import { getPresetTemplateFlat } from "./presets";
import type {
  ConfigurableEntitlementKey,
  EntitlementKey,
  FeatureOverrideKey,
  FeatureOverrides,
  OrganizationFeatures,
  ValidateFeaturesResult,
} from "./types";
import { buildOrganizationFeaturesFromConfigurable } from "./helpers";

export function validateEffectiveFeatures(features: OrganizationFeatures): ValidateFeaturesResult {
  const errors: string[] = [];

  if (features.schemaVersion !== 1) {
    errors.push(`schemaVersion desteklenmiyor: ${String(features.schemaVersion)}`);
  }

  if (features.core !== true) {
    errors.push("core her zaman true olmalıdır.");
  }

  if (features.athlete !== true) {
    errors.push("athlete her zaman true olmalıdır.");
  }

  for (const key of CONFIGURABLE_ENTITLEMENT_KEYS) {
    if (typeof features[key] !== "boolean") {
      errors.push(`Eksik veya geçersiz entitlement: ${key}`);
    }
  }

  const seen = new Set<string>();
  for (const key of Object.keys(features)) {
    if (seen.has(key)) {
      errors.push(`Yinelenen anahtar: ${key}`);
    }
    seen.add(key);
    if (key === "schemaVersion" || key === "core" || key === "athlete") {
      continue;
    }
    if (!isCanonicalEntitlementKey(key)) {
      errors.push(`Bilinmeyen canonical olmayan anahtar: ${key}`);
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function validateOverrideKeys(overrides: FeatureOverrides): ValidateFeaturesResult {
  const errors: string[] = [];

  for (const key of Object.keys(overrides)) {
    if (!isValidOverrideKey(key)) {
      errors.push(`Geçersiz override anahtarı: ${key}`);
    }
    if (typeof overrides[key as FeatureOverrideKey] !== "boolean") {
      errors.push(`Override değeri boolean olmalı: ${key}`);
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function validatePresetId(preset: string): ValidateFeaturesResult {
  if (
    preset === "academy_lite" ||
    preset === "academy_plus" ||
    preset === "club_professional" ||
    preset === "club_enterprise" ||
    preset === "custom"
  ) {
    return { ok: true };
  }
  return { ok: false, errors: [`Bilinmeyen preset: ${preset}`] };
}

function isValidOverrideKey(key: string): key is FeatureOverrideKey {
  return isCanonicalEntitlementKey(key) || isFeatureBundleParentKey(key);
}

export function assertAlwaysOnEntitlements(features: OrganizationFeatures): OrganizationFeatures {
  return {
    ...features,
    core: true,
    athlete: true,
  };
}

export function diffOverridesFromTemplate(
  preset: Parameters<typeof getPresetTemplateFlat>[0],
  effectiveConfigurable: Record<ConfigurableEntitlementKey, boolean>
): FeatureOverrides {
  const template = getPresetTemplateFlat(preset);
  const overrides: FeatureOverrides = {};

  for (const key of CONFIGURABLE_ENTITLEMENT_KEYS) {
    if (effectiveConfigurable[key] !== template[key]) {
      overrides[key] = effectiveConfigurable[key];
    }
  }

  return overrides;
}

export function applyOverrideToConfigurableMap(
  base: Record<ConfigurableEntitlementKey, boolean>,
  overrides: FeatureOverrides
): Record<ConfigurableEntitlementKey, boolean> {
  const next = { ...base };
  const explicitChildKeys = new Set<string>();

  // Pass 1: canonical child anahtarlari — parent bundle'dan bagimsiz, insertion order'dan bagimsiz.
  for (const [rawKey, value] of Object.entries(overrides)) {
    if (typeof value !== "boolean") {
      continue;
    }
    if (isFeatureBundleParentKey(rawKey)) {
      continue;
    }
    if (isCanonicalEntitlementKey(rawKey) && !isAlwaysOnEntitlementKey(rawKey)) {
      next[rawKey as ConfigurableEntitlementKey] = value;
      explicitChildKeys.add(rawKey);
    }
  }

  // Pass 2: bundle parent — yalnizca acik child override'i olmayan alt anahtarlara uygulanir.
  for (const [rawKey, value] of Object.entries(overrides)) {
    if (typeof value !== "boolean") {
      continue;
    }
    if (!isFeatureBundleParentKey(rawKey)) {
      continue;
    }
    for (const childKey of FEATURE_BUNDLE_CHILD_KEYS[rawKey]) {
      if (!explicitChildKeys.has(childKey)) {
        next[childKey as ConfigurableEntitlementKey] = value;
      }
    }
  }

  return next;
}

export function stripUnknownFeatureKeys(raw: Record<string, unknown>): Record<string, unknown> {
  const stripped: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (key === "schemaVersion" || isCanonicalEntitlementKey(key)) {
      stripped[key] = value;
    }
  }

  return stripped;
}

export function readBooleanOrUndefined(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export type FailClosedConfigurable = Record<ConfigurableEntitlementKey, boolean>;

export function createFailClosedConfigurable(): FailClosedConfigurable {
  return Object.fromEntries(CONFIGURABLE_ENTITLEMENT_KEYS.map((key) => [key, false])) as FailClosedConfigurable;
}

export function createLegacyDefaultConfigurable(): FailClosedConfigurable {
  return Object.fromEntries(CONFIGURABLE_ENTITLEMENT_KEYS.map((key) => [key, true])) as FailClosedConfigurable;
}
