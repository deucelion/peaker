import { getCatalogEntry, MODULE_CATALOG } from "./catalog";
import {
  CONFIGURABLE_ENTITLEMENT_KEYS,
  isAlwaysOnEntitlementKey,
  isFeatureBundleParentKey,
  UI_BUNDLE_KEYS,
} from "./keys";
import { getPresetTemplateFlat } from "./presets";
import type {
  ConfigurableEntitlementKey,
  FeatureBundleParentKey,
  FeatureOverrides,
  FeaturePresetId,
  OrganizationFeatures,
} from "./types";
import { applyOverrideToConfigurableMap } from "./validation";

/**
 * Super Admin editor metinleri — runtime/gating okumaz.
 * Branding tarafindaki `editorValidation` ile ayni rolu ustlenir.
 */
export const FEATURE_PRESET_LABELS: Readonly<Record<FeaturePresetId, string>> = {
  academy_lite: "Academy Lite",
  academy_plus: "Academy Plus",
  club_professional: "Club Professional",
  club_enterprise: "Club Enterprise",
  custom: "Özel Paket",
};

export const FEATURE_PRESET_ORDER: readonly FeaturePresetId[] = [
  "academy_lite",
  "academy_plus",
  "club_professional",
  "club_enterprise",
  "custom",
];

export function getFeaturePresetLabel(preset: FeaturePresetId): string {
  return FEATURE_PRESET_LABELS[preset];
}

export function getEntitlementLabel(key: ConfigurableEntitlementKey): string {
  return getCatalogEntry(key)?.label ?? key;
}

export const FEATURE_BUNDLE_PARENT_LABELS: Readonly<Record<FeatureBundleParentKey, string>> = {
  insight: "Performans & Raporlama",
};

/** Modülün kullanıcıya ne sağladığını anlatan kısa editör metni. */
export const ENTITLEMENT_DESCRIPTIONS: Readonly<Record<ConfigurableEntitlementKey, string>> = {
  private_lessons: "Özel ders paketleri, planlama ve paket yaşam döngüsü.",
  finance: "Tahsilat merkezi, muhasebe, ödemeler ve koç hakedişleri.",
  communications: "Bildirim merkezi ve bildirim tercihleri.",
  audit: "Audit log kayıtları ve dışa aktarımı.",
  "insight.performance": "Performans analitiği ekranı ve raporları.",
  "insight.field_tests": "Saha testi oturumları, metrikler ve sonuç girişi.",
  "insight.body_measurements": "Sporcu vücut ölçümü kaydı ve takibi.",
  "insight.development_hub": "Sporcu gelişim profili paneli.",
  "insight.training_reports": "Günlük idman yükü raporları.",
  "insight.wellness_archive": "Sabah raporu ve wellness arşivi.",
};

export function getEntitlementDescription(key: ConfigurableEntitlementKey): string {
  return ENTITLEMENT_DESCRIPTIONS[key] ?? "";
}

export function getFeatureBundleParentLabel(parent: FeatureBundleParentKey): string {
  return FEATURE_BUNDLE_PARENT_LABELS[parent];
}

export type FeatureEditorGroup =
  | { kind: "single"; key: ConfigurableEntitlementKey }
  | {
      kind: "bundle";
      parent: FeatureBundleParentKey;
      children: readonly ConfigurableEntitlementKey[];
    };

function buildFeatureEditorGroups(): readonly FeatureEditorGroup[] {
  const groups: FeatureEditorGroup[] = [];

  for (const bundleKey of UI_BUNDLE_KEYS) {
    if (isFeatureBundleParentKey(bundleKey)) {
      const children = MODULE_CATALOG.filter(
        (entry) => entry.bundleParent === bundleKey && !entry.alwaysOn
      ).map((entry) => entry.key as ConfigurableEntitlementKey);
      groups.push({ kind: "bundle", parent: bundleKey, children });
      continue;
    }

    if (!isAlwaysOnEntitlementKey(bundleKey)) {
      groups.push({ kind: "single", key: bundleKey as ConfigurableEntitlementKey });
    }
  }

  return groups;
}

/**
 * Editor gruplari — `UI_BUNDLE_KEYS` sirasi ve katalogdaki `bundleParent`
 * iliskisinden turetilir. Yeni bir hiyerarsi tanimlanmaz.
 */
export const FEATURE_EDITOR_GROUPS: readonly FeatureEditorGroup[] = buildFeatureEditorGroups();

/**
 * Kaydedildiginde olusacak configurable entitlement haritasi.
 * Named preset → sablon (override temizlenir).
 * `custom` → mevcut override'lar korunur.
 * Bu kural `organizationFeatureActions` write davranisiyla ayni kalmalidir.
 */
export function previewPresetConfigurable(
  preset: FeaturePresetId,
  currentOverrides: FeatureOverrides
): Record<ConfigurableEntitlementKey, boolean> {
  const template = getPresetTemplateFlat(preset);
  if (preset !== "custom") {
    return template;
  }
  return applyOverrideToConfigurableMap(template, currentOverrides);
}

export type PresetEntitlementSummary = {
  enabled: readonly ConfigurableEntitlementKey[];
  disabled: readonly ConfigurableEntitlementKey[];
};

export function summarizeConfigurableEntitlements(
  configurable: Record<ConfigurableEntitlementKey, boolean>
): PresetEntitlementSummary {
  const enabled: ConfigurableEntitlementKey[] = [];
  const disabled: ConfigurableEntitlementKey[] = [];

  for (const key of CONFIGURABLE_ENTITLEMENT_KEYS) {
    if (configurable[key]) {
      enabled.push(key);
    } else {
      disabled.push(key);
    }
  }

  return { enabled, disabled };
}

export function countConfigurableEntitlements(): number {
  return CONFIGURABLE_ENTITLEMENT_KEYS.length;
}

/**
 * Custom paket icin override yuku — yalnizca canonical child key'ler yazilir.
 * `applyOverrideToConfigurableMap` bundle parent'i anahtar sirasina gore genislettigi
 * icin parent key yazmak sira bagimli sonuc uretebilir; editor bu belirsizligi uretmez.
 */
export function buildCustomOverrides(
  desired: Record<ConfigurableEntitlementKey, boolean>
): FeatureOverrides {
  const overrides: FeatureOverrides = {};
  for (const key of CONFIGURABLE_ENTITLEMENT_KEYS) {
    overrides[key] = Boolean(desired[key]);
  }
  return overrides;
}

export function areConfigurableMapsEqual(
  left: Record<ConfigurableEntitlementKey, boolean>,
  right: Record<ConfigurableEntitlementKey, boolean>
): boolean {
  return CONFIGURABLE_ENTITLEMENT_KEYS.every((key) => Boolean(left[key]) === Boolean(right[key]));
}

/**
 * Kaydedilmis efektif durum — DB'de materialize edilmis `features` kolonundan okunur.
 * Yeniden hesaplama yapilmaz.
 */
export function configurableFromFeatures(
  features: OrganizationFeatures
): Record<ConfigurableEntitlementKey, boolean> {
  const configurable = {} as Record<ConfigurableEntitlementKey, boolean>;
  for (const key of CONFIGURABLE_ENTITLEMENT_KEYS) {
    configurable[key] = Boolean(features[key]);
  }
  return configurable;
}
