import { FEATURE_SCHEMA_VERSION } from "./keys";
import type { EntitlementKey, FeatureCatalogEntry } from "./types";

/**
 * Module Catalog — metadata only.
 * Runtime logic, route maps ve snapshot dalları burada yok.
 */
export const MODULE_CATALOG: readonly FeatureCatalogEntry[] = [
  {
    key: "core",
    label: "Çekirdek platform",
    category: "platform",
    alwaysOn: true,
    bundleParent: null,
    schemaVersion: FEATURE_SCHEMA_VERSION,
  },
  {
    key: "athlete",
    label: "Sporcu deneyimi (çekirdek)",
    category: "athlete_experience",
    alwaysOn: true,
    bundleParent: null,
    schemaVersion: FEATURE_SCHEMA_VERSION,
  },
  {
    key: "private_lessons",
    label: "Özel ders",
    category: "revenue",
    alwaysOn: false,
    bundleParent: null,
    schemaVersion: FEATURE_SCHEMA_VERSION,
    dependsOn: [
      {
        key: "finance",
        type: "soft",
        messageTr: "Finans kapalıyken tahsilat entegrasyonu sınırlı kalır.",
      },
    ],
  },
  {
    key: "finance",
    label: "Finans",
    category: "revenue",
    alwaysOn: false,
    bundleParent: null,
    schemaVersion: FEATURE_SCHEMA_VERSION,
  },
  {
    key: "insight.performance",
    label: "Performans analitiği",
    category: "analytics",
    alwaysOn: false,
    bundleParent: "insight",
    schemaVersion: FEATURE_SCHEMA_VERSION,
  },
  {
    key: "insight.field_tests",
    label: "Saha testleri",
    category: "analytics",
    alwaysOn: false,
    bundleParent: "insight",
    schemaVersion: FEATURE_SCHEMA_VERSION,
  },
  {
    key: "insight.body_measurements",
    label: "Vücut ölçümleri",
    category: "analytics",
    alwaysOn: false,
    bundleParent: "insight",
    schemaVersion: FEATURE_SCHEMA_VERSION,
  },
  {
    key: "insight.development_hub",
    label: "Gelişim profili",
    category: "analytics",
    alwaysOn: false,
    bundleParent: "insight",
    schemaVersion: FEATURE_SCHEMA_VERSION,
  },
  {
    key: "insight.training_reports",
    label: "İdman raporu",
    category: "analytics",
    alwaysOn: false,
    bundleParent: "insight",
    schemaVersion: FEATURE_SCHEMA_VERSION,
  },
  {
    key: "insight.wellness_archive",
    label: "Wellness arşivi",
    category: "analytics",
    alwaysOn: false,
    bundleParent: "insight",
    schemaVersion: FEATURE_SCHEMA_VERSION,
  },
  {
    key: "communications",
    label: "Bildirimler",
    category: "communications",
    alwaysOn: false,
    bundleParent: null,
    schemaVersion: FEATURE_SCHEMA_VERSION,
  },
  {
    key: "audit",
    label: "Audit",
    category: "governance",
    alwaysOn: false,
    bundleParent: null,
    schemaVersion: FEATURE_SCHEMA_VERSION,
  },
] as const;

const CATALOG_BY_KEY = new Map(MODULE_CATALOG.map((entry) => [entry.key, entry]));

export function getCatalogEntry(key: EntitlementKey): FeatureCatalogEntry | undefined {
  return CATALOG_BY_KEY.get(key);
}
