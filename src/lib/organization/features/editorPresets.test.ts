import { describe, expect, it } from "vitest";
import {
  areConfigurableMapsEqual,
  buildCustomOverrides,
  configurableFromFeatures,
  FEATURE_EDITOR_GROUPS,
  FEATURE_PRESET_LABELS,
  FEATURE_PRESET_ORDER,
  getEntitlementDescription,
  getEntitlementLabel,
  getFeatureBundleParentLabel,
  previewPresetConfigurable,
  summarizeConfigurableEntitlements,
} from "./editorPresets";
import {
  CONFIGURABLE_ENTITLEMENT_KEYS,
  FEATURE_BUNDLE_CHILD_KEYS,
  UI_BUNDLE_KEYS,
} from "./keys";
import { createClubProfessionalFeatures, getPresetTemplateFlat } from "./presets";
import { FEATURE_PRESET_IDS } from "./types";
import { recomputeEffective } from "./recompute";
import type { ConfigurableEntitlementKey, FeatureOverrides } from "./types";

describe("feature preset editor metadata", () => {
  it("labels every supported preset id", () => {
    for (const preset of FEATURE_PRESET_IDS) {
      expect(FEATURE_PRESET_LABELS[preset]).toBeTruthy();
    }
  });

  it("offers exactly the presets the schema supports", () => {
    expect([...FEATURE_PRESET_ORDER].sort()).toEqual([...FEATURE_PRESET_IDS].sort());
  });

  it("labels every configurable entitlement from the module catalog", () => {
    for (const key of CONFIGURABLE_ENTITLEMENT_KEYS) {
      const label = getEntitlementLabel(key);
      expect(label).toBeTruthy();
      expect(label).not.toBe(key);
    }
  });

  it("describes every configurable entitlement without leaking the raw key", () => {
    for (const key of CONFIGURABLE_ENTITLEMENT_KEYS) {
      const description = getEntitlementDescription(key);
      expect(description).toBeTruthy();
      expect(description).not.toContain(key);
    }
  });
});

describe("feature editor grouping", () => {
  it("derives groups from UI_BUNDLE_KEYS order", () => {
    const groupKeys = FEATURE_EDITOR_GROUPS.map((group) =>
      group.kind === "single" ? group.key : group.parent
    );

    expect(groupKeys).toEqual([...UI_BUNDLE_KEYS]);
  });

  it("expands the insight bundle to exactly the canonical child keys", () => {
    const bundle = FEATURE_EDITOR_GROUPS.find((group) => group.kind === "bundle");

    expect(bundle).toBeDefined();
    if (bundle && bundle.kind === "bundle") {
      expect(bundle.parent).toBe("insight");
      expect([...bundle.children].sort()).toEqual([...FEATURE_BUNDLE_CHILD_KEYS.insight].sort());
      expect(getFeatureBundleParentLabel(bundle.parent)).toBeTruthy();
    }
  });

  it("covers every configurable entitlement exactly once across groups", () => {
    const covered = FEATURE_EDITOR_GROUPS.flatMap((group) =>
      group.kind === "single" ? [group.key] : [...group.children]
    );

    expect([...covered].sort()).toEqual([...CONFIGURABLE_ENTITLEMENT_KEYS].sort());
    expect(new Set(covered).size).toBe(covered.length);
  });

  it("never exposes an always-on entitlement as an editable control", () => {
    const covered = FEATURE_EDITOR_GROUPS.flatMap((group) =>
      group.kind === "single" ? [group.key] : [...group.children]
    );

    expect(covered).not.toContain("core");
    expect(covered).not.toContain("athlete");
  });
});

describe("preset preview parity with recomputeEffective", () => {
  const overrides: FeatureOverrides = { finance: true, "insight.field_tests": false };

  it.each(["academy_lite", "academy_plus", "club_professional", "club_enterprise"] as const)(
    "named preset %s previews the template the write path will persist",
    (preset) => {
      const previewed = previewPresetConfigurable(preset, overrides);
      // Named presets are saved with cleared overrides, matching organizationFeatureActions.
      const recomputed = recomputeEffective({ preset, overrides: {} });

      expect(recomputed.ok).toBe(true);
      if (recomputed.ok) {
        for (const key of CONFIGURABLE_ENTITLEMENT_KEYS) {
          expect(previewed[key]).toBe(recomputed.features[key]);
        }
      }
    }
  );

  it("custom preview applies the preserved overrides the write path will persist", () => {
    const previewed = previewPresetConfigurable("custom", overrides);
    const recomputed = recomputeEffective({ preset: "custom", overrides });

    expect(recomputed.ok).toBe(true);
    if (recomputed.ok) {
      for (const key of CONFIGURABLE_ENTITLEMENT_KEYS) {
        expect(previewed[key]).toBe(recomputed.features[key]);
      }
      expect(previewed.finance).toBe(true);
      expect(previewed["insight.field_tests"]).toBe(false);
    }
  });

  it("custom preview fans out the insight bundle parent override", () => {
    const previewed = previewPresetConfigurable("custom", { insight: true });

    expect(previewed["insight.performance"]).toBe(true);
    expect(previewed["insight.wellness_archive"]).toBe(true);
    expect(previewed.finance).toBe(false);
  });
});

describe("configurable entitlement summary", () => {
  it("splits enabled and disabled keys without dropping any", () => {
    const summary = summarizeConfigurableEntitlements(previewPresetConfigurable("academy_plus", {}));

    expect(summary.enabled).toEqual(["private_lessons"]);
    expect(summary.enabled.length + summary.disabled.length).toBe(CONFIGURABLE_ENTITLEMENT_KEYS.length);
  });

  it("reports every configurable entitlement as enabled for club professional", () => {
    const summary = summarizeConfigurableEntitlements(previewPresetConfigurable("club_professional", {}));

    expect(summary.disabled).toEqual([]);
    expect(summary.enabled.length).toBe(CONFIGURABLE_ENTITLEMENT_KEYS.length);
  });

  it("reports no optional entitlements for academy lite", () => {
    const summary = summarizeConfigurableEntitlements(previewPresetConfigurable("academy_lite", {}));

    expect(summary.enabled).toEqual([]);
  });
});

describe("custom override construction", () => {
  function makeMap(enabled: readonly ConfigurableEntitlementKey[]): Record<ConfigurableEntitlementKey, boolean> {
    const map = {} as Record<ConfigurableEntitlementKey, boolean>;
    for (const key of CONFIGURABLE_ENTITLEMENT_KEYS) {
      map[key] = enabled.includes(key);
    }
    return map;
  }

  it("emits an explicit boolean for every configurable key", () => {
    const overrides = buildCustomOverrides(makeMap(["finance"]));

    expect(Object.keys(overrides).sort()).toEqual([...CONFIGURABLE_ENTITLEMENT_KEYS].sort());
    expect(overrides.finance).toBe(true);
    expect(overrides.audit).toBe(false);
  });

  it("never emits the insight bundle parent key", () => {
    const overrides = buildCustomOverrides(makeMap(CONFIGURABLE_ENTITLEMENT_KEYS));

    expect(Object.keys(overrides)).not.toContain("insight");
  });

  it("round-trips through recomputeEffective to the intended map", () => {
    const desired = makeMap(["finance", "insight.field_tests", "audit"]);
    const recomputed = recomputeEffective({ preset: "custom", overrides: buildCustomOverrides(desired) });

    expect(recomputed.ok).toBe(true);
    if (recomputed.ok) {
      for (const key of CONFIGURABLE_ENTITLEMENT_KEYS) {
        expect(recomputed.features[key]).toBe(desired[key]);
      }
    }
  });

  it("matches the bundle-parent shorthand when every insight child is enabled", () => {
    const viaChildren = recomputeEffective({
      preset: "custom",
      overrides: buildCustomOverrides(makeMap([...FEATURE_BUNDLE_CHILD_KEYS.insight] as ConfigurableEntitlementKey[])),
    });
    const viaParent = recomputeEffective({ preset: "custom", overrides: { insight: true } });

    expect(viaChildren.ok).toBe(true);
    expect(viaParent.ok).toBe(true);
    if (viaChildren.ok && viaParent.ok) {
      for (const key of CONFIGURABLE_ENTITLEMENT_KEYS) {
        expect(viaChildren.features[key]).toBe(viaParent.features[key]);
      }
    }
  });

  it("keeps the editor preview aligned with the persisted effective map", () => {
    const desired = makeMap(["private_lessons", "insight.performance"]);
    const overrides = buildCustomOverrides(desired);
    const previewed = previewPresetConfigurable("custom", overrides);
    const recomputed = recomputeEffective({ preset: "custom", overrides });

    expect(recomputed.ok).toBe(true);
    if (recomputed.ok) {
      expect(areConfigurableMapsEqual(previewed, configurableFromFeatures(recomputed.features))).toBe(true);
    }
  });
});

describe("configurable map helpers", () => {
  it("reads the configurable slice out of a materialized features map", () => {
    const configurable = configurableFromFeatures(createClubProfessionalFeatures());

    expect(Object.keys(configurable).sort()).toEqual([...CONFIGURABLE_ENTITLEMENT_KEYS].sort());
    expect(Object.values(configurable).every(Boolean)).toBe(true);
  });

  it("treats identical maps as equal and differing maps as unequal", () => {
    const professional = getPresetTemplateFlat("club_professional");
    const lite = getPresetTemplateFlat("academy_lite");

    expect(areConfigurableMapsEqual(professional, { ...professional })).toBe(true);
    expect(areConfigurableMapsEqual(professional, lite)).toBe(false);
  });

  it("detects a single toggled entitlement as a change", () => {
    const base = getPresetTemplateFlat("club_professional");
    const changed = { ...base, finance: false };

    expect(areConfigurableMapsEqual(base, changed)).toBe(false);
  });

  it("keeps always-on entitlements enabled even if an override tries to disable them", () => {
    const recomputed = recomputeEffective({ preset: "custom", overrides: { core: false, athlete: false } });

    expect(recomputed.ok).toBe(true);
    if (recomputed.ok) {
      expect(recomputed.features.core).toBe(true);
      expect(recomputed.features.athlete).toBe(true);
    }
  });
});
