import { CONFIGURABLE_ENTITLEMENT_KEYS, FEATURE_SCHEMA_VERSION } from "./keys";
import {
  assertAlwaysOnEntitlements,
  createFailClosedConfigurable,
  createLegacyDefaultConfigurable,
  readBooleanOrUndefined,
  stripUnknownFeatureKeys,
  validateEffectiveFeatures,
} from "./validation";
import { buildOrganizationFeaturesFromConfigurable } from "./helpers";
import type { OrganizationFeatures, ParseOrganizationFeaturesResult } from "./types";

/**
 * ADR parse policy:
 * - core / athlete missing → true
 * - diğer canonical missing → true (legacy geriye uyum)
 * - unknown key → strip
 * - bozuk payload → fail-closed optional (core/athlete true, diğerleri false)
 */
export function parseOrganizationFeatures(raw: unknown): ParseOrganizationFeaturesResult {
  if (raw === null || raw === undefined) {
    return failClosed("invalid_payload");
  }

  if (typeof raw !== "object" || Array.isArray(raw)) {
    return failClosed("non_object");
  }

  const record = stripUnknownFeatureKeys(raw as Record<string, unknown>);

  const schemaVersionRaw = record.schemaVersion;
  if (schemaVersionRaw !== undefined && schemaVersionRaw !== FEATURE_SCHEMA_VERSION) {
    return failClosed("invalid_payload");
  }

  const configurable = createLegacyDefaultConfigurable();

  for (const key of CONFIGURABLE_ENTITLEMENT_KEYS) {
    const parsed = readBooleanOrUndefined(record[key]);
    if (parsed !== undefined) {
      configurable[key] = parsed;
    }
  }

  const features = assertAlwaysOnEntitlements(buildOrganizationFeaturesFromConfigurable(configurable));
  const validation = validateEffectiveFeatures(features);

  if (!validation.ok) {
    return failClosed("invalid_payload");
  }

  return { ok: true, features };
}

function failClosed(reason: ParseOrganizationFeaturesResult extends { ok: false; reason: infer R } ? R : never) {
  const features = assertAlwaysOnEntitlements(
    buildOrganizationFeaturesFromConfigurable(createFailClosedConfigurable())
  );
  return { ok: false as const, features, reason };
}

export function normalizeOrganizationFeatures(raw: unknown): OrganizationFeatures {
  const parsed = parseOrganizationFeatures(raw);
  return parsed.features;
}

export function isOrganizationFeatures(value: unknown): value is OrganizationFeatures {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const parsed = parseOrganizationFeatures(value);
  return parsed.ok;
}
