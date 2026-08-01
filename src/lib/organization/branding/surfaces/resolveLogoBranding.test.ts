import { describe, expect, it } from "vitest";
import { createDefaultBranding } from "../defaults";
import { mergeBranding } from "../helpers";
import { BRANDING_CANONICAL_SECTION_REFS } from "./types";
import { LOGO_BRANDING_MAP, LOGO_SURFACE_IDS } from "./logoBrandingMap";
import { resolveLogoBranding } from "./resolveLogoBranding";

describe("resolveLogoBranding", () => {
  it("returns default logo when snapshot is null", () => {
    const result = resolveLogoBranding(null);
    expect(result.logo).toEqual(createDefaultBranding().assets.logo);
    expect(result.brandingRevision).toBe(0);
    expect(result.sectionRef).toBe(BRANDING_CANONICAL_SECTION_REFS.assetsLogo);
  });

  it("returns runtime logo asset from organizationBranding snapshot", () => {
    const branding = mergeBranding(createDefaultBranding(), {
      assets: {
        logo: {
          ...createDefaultBranding().assets.logo,
          assetId: "club-logo",
          storagePath: "branding/org-1/logo.svg",
        },
      },
      brandingRevision: 3,
    });

    const result = resolveLogoBranding(branding);
    expect(result.logo.assetId).toBe("club-logo");
    expect(result.logo.storagePath).toBe("branding/org-1/logo.svg");
    expect(result.brandingRevision).toBe(3);
  });

  it("uses LOGO_BRANDING_MAP assets.logo section instead of hardcoded paths", () => {
    const result = resolveLogoBranding(createDefaultBranding());
    expect(result.sectionRef).toBe(LOGO_BRANDING_MAP[LOGO_SURFACE_IDS.logo]);
    expect(result.sectionRef).toBe(BRANDING_CANONICAL_SECTION_REFS.assetsLogo);
  });

  it("falls back safely for repository-error style snapshots", () => {
    const result = resolveLogoBranding(createDefaultBranding());
    expect(result.logo).toEqual(createDefaultBranding().assets.logo);
    expect(result.brandingRevision).toBe(0);
  });

  it("falls back safely for parse-error style incomplete snapshots", () => {
    const brokenSnapshot = {
      ...createDefaultBranding(),
      assets: {
        ...createDefaultBranding().assets,
        logo: {
          assetId: "",
          kind: "logo",
          storagePath: "",
          contentType: "",
          updatedAt: "invalid",
        },
      },
    };

    const result = resolveLogoBranding(brokenSnapshot);
    expect(result.logo).toEqual(createDefaultBranding().assets.logo);
  });

  it("never throws for unexpected snapshot shapes", () => {
    expect(() => resolveLogoBranding(null)).not.toThrow();
    expect(() => resolveLogoBranding({} as never)).not.toThrow();
  });
});
