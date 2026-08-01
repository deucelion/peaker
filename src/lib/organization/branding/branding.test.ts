import { describe, expect, it } from "vitest";
import { createDefaultBranding } from "./defaults";
import {
  cloneBranding,
  isBrandingEqual,
  mergeBranding,
  mergeBrandingAssetReferences,
  mergeBrandingThemeFromPartial,
  parseBrandingAssetReference,
} from "./helpers";
import {
  normalizeOrganizationBranding,
  parseOrganizationBranding,
  isOrganizationBranding,
} from "./parser";
import {
  BRANDING_ASSET_KINDS,
  BRANDING_COLOR_TOKEN_KEYS,
  BRANDING_SCHEMA_VERSION,
  BRANDING_TEXT_TOKEN_KEYS,
} from "./tokens";
import {
  isValidBrandingColor,
  validateBranding,
  validateBrandingAssets,
  validateBrandingTokens,
} from "./validation";

describe("default branding", () => {
  it("creates Peaker default branding with canonical schema version", () => {
    const branding = createDefaultBranding();
    expect(branding.schemaVersion).toBe(BRANDING_SCHEMA_VERSION);
    expect(branding.brandingRevision).toBe(0);
    expect(branding.application.appName).toBe("PEAKER");
    expect(branding.application.shortName).toBe("Peaker");
    expect(branding.pdf.title).toBe("PEAKER Rapor");
    expect(branding.email.title).toBe("PEAKER");
  });

  it("stores assets as references without binary payload", () => {
    const branding = createDefaultBranding();
    expect(branding.assets.logo.storagePath).toBe("branding/defaults/logo.svg");
    expect(branding.assets.logo.contentType).toBe("image/svg+xml");
    expect(branding.assets.logo).not.toHaveProperty("data");
    expect(branding.assets.logo).not.toHaveProperty("base64");
  });

  it("uses canonical color tokens in theme", () => {
    const branding = createDefaultBranding();
    expect(branding.theme.primary).toBe("#7c3aed");
    expect(BRANDING_COLOR_TOKEN_KEYS.primary).toBe("PRIMARY");
    expect(BRANDING_TEXT_TOKEN_KEYS.appName).toBe("APP_NAME");
  });
});

describe("parseOrganizationBranding", () => {
  it("returns default branding for null input", () => {
    const result = parseOrganizationBranding(null);
    expect(result.ok).toBe(true);
    expect(result.branding.application.appName).toBe("PEAKER");
  });

  it("returns default branding for undefined input", () => {
    const branding = normalizeOrganizationBranding(undefined);
    expect(branding.theme.primary).toBe("#7c3aed");
  });

  it("fills missing fields from default branding", () => {
    const result = parseOrganizationBranding({
      schemaVersion: 1,
      brandingRevision: 2,
      application: { appName: "Custom Club" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.branding.brandingRevision).toBe(2);
      expect(result.branding.application.appName).toBe("Custom Club");
      expect(result.branding.application.shortName).toBe("Peaker");
      expect(result.branding.assets.logo.assetId).toBe("peaker-default-logo");
    }
  });

  it("strips unknown top-level fields", () => {
    const result = parseOrganizationBranding({
      schemaVersion: 1,
      unknownBrandingField: true,
      theme: {
        primary: "#111111",
        unknownThemeField: "#222222",
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect("unknownBrandingField" in result.branding).toBe(false);
      expect(result.branding.theme.primary).toBe("#111111");
      expect("unknownThemeField" in result.branding.theme).toBe(false);
    }
  });

  it("fail-closes to default branding on unsupported schema version", () => {
    const result = parseOrganizationBranding({ schemaVersion: 99, theme: { primary: "#111111" } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unsupported_schema");
      expect(result.branding.application.appName).toBe("PEAKER");
    }
  });

  it("fail-closes to default branding on non-object payload", () => {
    const result = parseOrganizationBranding("invalid");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("non_object");
      expect(result.branding.theme.primary).toBe("#7c3aed");
    }
  });

  it("fail-closes to default branding on invalid color token values", () => {
    const result = parseOrganizationBranding({
      schemaVersion: 1,
      theme: { primary: "not-a-color" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_payload");
    }
  });

  it("normalizes partial asset references immutably", () => {
    const result = parseOrganizationBranding({
      schemaVersion: 1,
      assets: {
        logo: {
          assetId: "org-logo",
          kind: "logo",
          storagePath: "branding/org/logo.svg",
          contentType: "image/svg+xml",
          updatedAt: "2026-02-01T00:00:00.000Z",
        },
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.isFrozen(result.branding)).toBe(true);
      expect(Object.isFrozen(result.branding.theme)).toBe(true);
      expect(Object.isFrozen(result.branding.assets.logo)).toBe(true);
      expect(result.branding.assets.logo.assetId).toBe("org-logo");
      expect(result.branding.assets.mark.assetId).toBe("peaker-default-mark");
    }
  });
});

describe("branding helpers", () => {
  it("clones branding without mutating source", () => {
    const source = createDefaultBranding();
    const cloned = cloneBranding(source);
    expect(isBrandingEqual(source, cloned)).toBe(true);
    expect(cloned).not.toBe(source);
    expect(cloned.theme).not.toBe(source.theme);
  });

  it("merges theme partials over base theme", () => {
    const base = createDefaultBranding();
    const mergedTheme = mergeBrandingThemeFromPartial(base.theme, { primary: "#123456" });
    expect(mergedTheme.primary).toBe("#123456");
    expect(mergedTheme.secondary).toBe(base.theme.secondary);
  });

  it("merges asset references", () => {
    const base = createDefaultBranding();
    const merged = mergeBranding(base, {
      assets: {
        logo: {
          assetId: "custom-logo",
          storagePath: "branding/custom/logo.svg",
        },
      },
    });
    expect(merged.assets.logo.assetId).toBe("custom-logo");
    expect(merged.assets.logo.kind).toBe(BRANDING_ASSET_KINDS.logo);
    expect(merged.assets.favicon.assetId).toBe(base.assets.favicon.assetId);
  });

  it("merges individual asset reference fields", () => {
    const base = createDefaultBranding();
    const merged = mergeBrandingAssetReferences(base.assets.logo, {
      storagePath: "branding/patched/logo.svg",
    });
    expect(merged.storagePath).toBe("branding/patched/logo.svg");
    expect(merged.assetId).toBe(base.assets.logo.assetId);
  });

  it("detects branding equality", () => {
    const a = createDefaultBranding();
    const b = cloneBranding(a);
    const c = mergeBranding(a, { application: { appName: "Other" } });
    expect(isBrandingEqual(a, b)).toBe(true);
    expect(isBrandingEqual(a, c)).toBe(false);
  });

  it("falls back when asset reference payload is invalid", () => {
    const fallback = createDefaultBranding().assets.logo;
    const parsed = parseBrandingAssetReference({ assetId: "" }, fallback);
    expect(parsed.assetId).toBe(fallback.assetId);
  });
});

describe("branding validation", () => {
  it("validates default branding successfully", () => {
    expect(validateBranding(createDefaultBranding()).ok).toBe(true);
  });

  it("validates canonical theme tokens", () => {
    const branding = createDefaultBranding();
    expect(validateBrandingTokens(branding.theme).ok).toBe(true);
  });

  it("rejects invalid color formats", () => {
    expect(isValidBrandingColor("#7c3aed")).toBe(true);
    expect(isValidBrandingColor("#fff")).toBe(true);
    expect(isValidBrandingColor("purple")).toBe(false);
    expect(
      validateBrandingTokens({
        ...createDefaultBranding().theme,
        primary: "purple",
      }).ok
    ).toBe(false);
  });

  it("rejects unknown theme token keys", () => {
    const theme = {
      ...createDefaultBranding().theme,
      unknownToken: "#111111",
    } as typeof createDefaultBranding extends () => infer B ? B["theme"] : never;
    expect(validateBrandingTokens(theme).ok).toBe(false);
  });

  it("validates asset references", () => {
    const assets = createDefaultBranding().assets;
    expect(validateBrandingAssets(assets).ok).toBe(true);
  });

  it("rejects duplicate asset ids", () => {
    const assets = createDefaultBranding().assets;
    const invalid = {
      ...assets,
      mark: {
        ...assets.mark,
        assetId: assets.logo.assetId,
      },
    };
    expect(validateBrandingAssets(invalid).ok).toBe(false);
  });

  it("rejects invalid asset kind", () => {
    const assets = createDefaultBranding().assets;
    const invalid = {
      ...assets,
      logo: {
        ...assets.logo,
        kind: "banner" as typeof assets.logo.kind,
      },
    };
    expect(validateBrandingAssets(invalid).ok).toBe(false);
  });

  it("rejects invalid schema version in validateBranding", () => {
    const branding = mergeBranding(createDefaultBranding(), {});
    const invalid = { ...branding, schemaVersion: 99 as typeof branding.schemaVersion };
    expect(validateBranding(invalid).ok).toBe(false);
  });
});

describe("branding type guard", () => {
  it("accepts valid parsed branding objects", () => {
    const branding = normalizeOrganizationBranding({ schemaVersion: 1 });
    expect(isOrganizationBranding(branding)).toBe(true);
  });

  it("rejects non-object values", () => {
    expect(isOrganizationBranding("branding")).toBe(false);
  });
});
