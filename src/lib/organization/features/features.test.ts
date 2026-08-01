import { describe, expect, it } from "vitest";
import { MODULE_CATALOG, getCatalogEntry } from "./catalog";
import {
  ENTITLEMENT_KEYS,
  INSIGHT_BUNDLE_CHILD_KEYS,
  isAlwaysOnEntitlementKey,
  isCanonicalEntitlementKey,
} from "./keys";
import {
  createClubProfessionalFeatures,
  getPresetTemplateFlat,
  PRESET_TEMPLATES,
} from "./presets";
import {
  isEntitlementEnabled,
  buildOrganizationFeaturesFromConfigurable,
} from "./helpers";
import { normalizeOrganizationFeatures, parseOrganizationFeatures } from "./parser";
import { recomputeEffective } from "./recompute";
import {
  applyOverrideToConfigurableMap,
  diffOverridesFromTemplate,
  validateEffectiveFeatures,
  validateOverrideKeys,
} from "./validation";

describe("module catalog", () => {
  it("lists always-on platform keys", () => {
    expect(getCatalogEntry("core")?.alwaysOn).toBe(true);
    expect(getCatalogEntry("athlete")?.alwaysOn).toBe(true);
  });

  it("marks insight children with bundle parent", () => {
    for (const child of INSIGHT_BUNDLE_CHILD_KEYS) {
      expect(getCatalogEntry(child)?.bundleParent).toBe("insight");
    }
  });

  it("has unique catalog keys", () => {
    const keys = MODULE_CATALOG.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("preset templates", () => {
  it("academy_lite disables optional modules", () => {
    const template = getPresetTemplateFlat("academy_lite");
    expect(template.private_lessons).toBe(false);
    expect(template.finance).toBe(false);
    expect(template["insight.performance"]).toBe(false);
  });

  it("academy_plus enables private lessons only", () => {
    const template = getPresetTemplateFlat("academy_plus");
    expect(template.private_lessons).toBe(true);
    expect(template.finance).toBe(false);
  });

  it("club professional enables all configurable keys", () => {
    const template = getPresetTemplateFlat("club_professional");
    expect(Object.values(template).every(Boolean)).toBe(true);
  });

  it("createClubProfessionalFeatures matches professional template", () => {
    const features = createClubProfessionalFeatures();
    expect(features.core).toBe(true);
    expect(features.finance).toBe(true);
    expect(features["insight.field_tests"]).toBe(true);
  });

  it("custom preset template starts from all false", () => {
    const template = getPresetTemplateFlat("custom");
    expect(template.finance).toBe(false);
  });
});

describe("parseOrganizationFeatures", () => {
  it("defaults missing configurable keys to true for legacy compatibility", () => {
    const result = parseOrganizationFeatures({
      schemaVersion: 1,
      core: true,
      athlete: true,
      finance: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.features.finance).toBe(false);
      expect(result.features.private_lessons).toBe(true);
      expect(result.features.audit).toBe(true);
    }
  });

  it("strips unknown keys", () => {
    const result = parseOrganizationFeatures({
      schemaVersion: 1,
      core: true,
      athlete: true,
      unknown_feature: true,
      finance: false,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect("unknown_feature" in result.features).toBe(false);
      expect(result.features.finance).toBe(false);
    }
  });

  it("forces always-on keys even when input is false", () => {
    const result = parseOrganizationFeatures({
      schemaVersion: 1,
      core: false,
      athlete: false,
      finance: true,
    });

    expect(result.features.core).toBe(true);
    expect(result.features.athlete).toBe(true);
  });

  it("fail-closes optional modules on invalid payload", () => {
    const result = parseOrganizationFeatures(null);
    expect(result.ok).toBe(false);
    expect(result.features.core).toBe(true);
    expect(result.features.finance).toBe(false);
    expect(result.features["insight.performance"]).toBe(false);
  });

  it("rejects unsupported schema version", () => {
    const result = parseOrganizationFeatures({ schemaVersion: 99, finance: true });
    expect(result.ok).toBe(false);
    expect(result.features.finance).toBe(false);
  });

  it("normalizeOrganizationFeatures always returns a features object", () => {
    const normalized = normalizeOrganizationFeatures(undefined);
    expect(normalized.core).toBe(true);
    expect(normalized.finance).toBe(false);
  });
});

describe("recomputeEffective", () => {
  it("materializes academy lite preset", () => {
    const result = recomputeEffective({ preset: "academy_lite", overrides: {} });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.features.private_lessons).toBe(false);
      expect(result.features.communications).toBe(false);
      expect(result.overrides).toEqual({});
    }
  });

  it("applies override on top of preset template", () => {
    const result = recomputeEffective({
      preset: "academy_lite",
      overrides: { finance: true },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.features.finance).toBe(true);
      expect(result.features.private_lessons).toBe(false);
      expect(result.overrides.finance).toBe(true);
    }
  });

  it("expands insight bundle parent override to all child keys", () => {
    const result = recomputeEffective({
      preset: "academy_lite",
      overrides: { insight: true },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      for (const child of INSIGHT_BUNDLE_CHILD_KEYS) {
        expect(result.features[child]).toBe(true);
      }
      expect(result.features.finance).toBe(false);
    }
  });

  it("expands insight bundle parent off across children", () => {
    const result = recomputeEffective({
      preset: "club_professional",
      overrides: { insight: false },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      for (const child of INSIGHT_BUNDLE_CHILD_KEYS) {
        expect(result.features[child]).toBe(false);
      }
      expect(result.features.finance).toBe(true);
    }
  });

  it("allows partial insight child override on professional preset", () => {
    const result = recomputeEffective({
      preset: "club_professional",
      overrides: { "insight.field_tests": false },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.features["insight.field_tests"]).toBe(false);
      expect(result.features["insight.performance"]).toBe(true);
    }
  });

  it("always forces core and athlete true", () => {
    const result = recomputeEffective({
      preset: "academy_lite",
      overrides: {
        core: false,
        athlete: false,
      } as never,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.features.core).toBe(true);
      expect(result.features.athlete).toBe(true);
    }
  });

  it("rejects invalid override keys", () => {
    const result = recomputeEffective({
      preset: "academy_lite",
      overrides: { not_a_feature: true } as never,
    });
    expect(result.ok).toBe(false);
  });

  it("computes sparse overrides diff from preset", () => {
    const merged = applyOverrideToConfigurableMap(getPresetTemplateFlat("academy_lite"), {
      finance: true,
      communications: true,
    });
    const overrides = diffOverridesFromTemplate("academy_lite", merged);
    expect(overrides).toEqual({ finance: true, communications: true });
  });
});

describe("validation", () => {
  it("validates effective feature map shape", () => {
    const features = createClubProfessionalFeatures();
    expect(validateEffectiveFeatures(features)).toEqual({ ok: true });
  });

  it("rejects effective map missing configurable keys", () => {
    const broken = buildOrganizationFeaturesFromConfigurable({
      ...getPresetTemplateFlat("academy_lite"),
    });
    delete (broken as { finance?: boolean }).finance;
    expect(validateEffectiveFeatures(broken).ok).toBe(false);
  });

  it("validates override keys", () => {
    expect(validateOverrideKeys({ finance: true, insight: false }).ok).toBe(true);
    expect(validateOverrideKeys({ bogus: true } as never).ok).toBe(false);
  });
});

describe("helpers", () => {
  it("isEntitlementEnabled treats always-on keys as enabled", () => {
    const features = getPresetTemplateFlat("academy_lite");
    const org = buildOrganizationFeaturesFromConfigurable(features);
    expect(isEntitlementEnabled(org, ENTITLEMENT_KEYS.core)).toBe(true);
    expect(isEntitlementEnabled(org, ENTITLEMENT_KEYS.finance)).toBe(false);
  });

  it("isAlwaysOnEntitlementKey matches catalog", () => {
    expect(isAlwaysOnEntitlementKey("core")).toBe(true);
    expect(isAlwaysOnEntitlementKey("finance")).toBe(false);
  });

  it("isCanonicalEntitlementKey rejects bundle parent", () => {
    expect(isCanonicalEntitlementKey("insight")).toBe(false);
    expect(isCanonicalEntitlementKey("insight.performance")).toBe(true);
  });
});

describe("preset constants", () => {
  it("club enterprise matches club professional template in v1", () => {
    expect(PRESET_TEMPLATES.club_enterprise).toEqual(PRESET_TEMPLATES.club_professional);
  });
});
