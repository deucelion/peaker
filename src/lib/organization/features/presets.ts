import { buildOrganizationFeaturesFromConfigurable } from "./helpers";
import { CONFIGURABLE_ENTITLEMENT_KEYS, ENTITLEMENT_KEYS } from "./keys";
import type { ConfigurableEntitlementKey, FeaturePresetId, OrganizationFeatures } from "./types";

function allConfigurable(value: boolean): Record<ConfigurableEntitlementKey, boolean> {
  return Object.fromEntries(CONFIGURABLE_ENTITLEMENT_KEYS.map((key) => [key, value])) as Record<
    ConfigurableEntitlementKey,
    boolean
  >;
}

const ALL_FALSE = allConfigurable(false);

const ALL_TRUE = allConfigurable(true);

const ACADEMY_PLUS: Record<ConfigurableEntitlementKey, boolean> = {
  ...ALL_FALSE,
  [ENTITLEMENT_KEYS.privateLessons]: true,
};

/**
 * Preset şablonları — yalnızca kod; DB/runtime okumaz.
 * Flat canonical entitlement map (bundle parent key yok).
 */
export const PRESET_TEMPLATES: Readonly<
  Record<Exclude<FeaturePresetId, "custom">, Record<ConfigurableEntitlementKey, boolean>>
> = {
  academy_lite: ALL_FALSE,
  academy_plus: ACADEMY_PLUS,
  club_professional: ALL_TRUE,
  club_enterprise: ALL_TRUE,
};

export function getPresetTemplateFlat(preset: FeaturePresetId): Record<ConfigurableEntitlementKey, boolean> {
  if (preset === "custom") {
    return { ...ALL_FALSE };
  }
  return { ...PRESET_TEMPLATES[preset] };
}

export function isKnownFeaturePresetId(value: string): value is FeaturePresetId {
  return (
    value === "academy_lite" ||
    value === "academy_plus" ||
    value === "club_professional" ||
    value === "club_enterprise" ||
    value === "custom"
  );
}

/** Mevcut müşteriler — migration backfill referansı (FAZ 31.3.2). */
export function createClubProfessionalFeatures(): OrganizationFeatures {
  return buildOrganizationFeaturesFromConfigurable(ALL_TRUE);
}
