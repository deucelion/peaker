import { getPresetTemplateFlat } from "./presets";
import {
  applyOverrideToConfigurableMap,
  assertAlwaysOnEntitlements,
  diffOverridesFromTemplate,
  validateEffectiveFeatures,
  validateOverrideKeys,
  validatePresetId,
} from "./validation";
import { buildOrganizationFeaturesFromConfigurable } from "./helpers";
import type { FeatureOverrides, OrganizationFeatures, RecomputeEffectiveInput, RecomputeEffectiveResult } from "./types";

/**
 * Platform tek write path (FAZ 31 ADR).
 * preset + override → materialized effective features.
 * Runtime merge YASAK — bu fonksiyon yalnızca save/create sırasında çağrılır.
 */
export function recomputeEffective(input: RecomputeEffectiveInput): RecomputeEffectiveResult {
  const presetValidation = validatePresetId(input.preset);
  if (!presetValidation.ok) {
    return { ok: false, errors: presetValidation.errors };
  }

  const overrides: FeatureOverrides = { ...(input.overrides ?? {}) };
  const overrideValidation = validateOverrideKeys(overrides);
  if (!overrideValidation.ok) {
    return { ok: false, errors: overrideValidation.errors };
  }

  const template = getPresetTemplateFlat(input.preset);
  const mergedConfigurable = applyOverrideToConfigurableMap(template, overrides);
  const features = assertAlwaysOnEntitlements(buildOrganizationFeaturesFromConfigurable(mergedConfigurable));

  const effectiveValidation = validateEffectiveFeatures(features);
  if (!effectiveValidation.ok) {
    return { ok: false, errors: effectiveValidation.errors };
  }

  const normalizedOverrides =
    input.preset === "custom" ? sanitizeCustomOverrides(overrides) : diffOverridesFromTemplate(input.preset, mergedConfigurable);

  return {
    ok: true,
    features,
    overrides: normalizedOverrides,
  };
}

function sanitizeCustomOverrides(overrides: FeatureOverrides): FeatureOverrides {
  const next: FeatureOverrides = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === "boolean") {
      next[key as keyof FeatureOverrides] = value;
    }
  }
  return next;
}

export function recomputeEffectiveFeatures(input: RecomputeEffectiveInput): OrganizationFeatures {
  const result = recomputeEffective(input);
  if (!result.ok) {
    throw new Error(result.errors.join(" "));
  }
  return result.features;
}
