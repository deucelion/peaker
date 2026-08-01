import { describe, expect, it } from "vitest";
import { createDefaultBranding } from "../defaults";
import { mergeBranding } from "../helpers";
import { BRANDING_CANONICAL_SECTION_REFS } from "./types";
import { FAVICON_BRANDING_MAP, FAVICON_SURFACE_IDS } from "./faviconBrandingMap";
import { resolveFaviconBranding } from "./resolveFaviconBranding";

describe("resolveFaviconBranding", () => {
  it("returns default favicon when snapshot is null", () => {
    const result = resolveFaviconBranding(null);
    expect(result.favicon).toEqual(createDefaultBranding().assets.favicon);
    expect(result.brandingRevision).toBe(0);
    expect(result.sectionRef).toBe(BRANDING_CANONICAL_SECTION_REFS.assetsFavicon);
  });

  it("returns runtime favicon asset from organizationBranding snapshot", () => {
    const branding = mergeBranding(createDefaultBranding(), {
      assets: {
        favicon: {
          ...createDefaultBranding().assets.favicon,
          assetId: "club-favicon",
          storagePath: "branding/org-1/favicon.ico",
        },
      },
      brandingRevision: 2,
    });

    const result = resolveFaviconBranding(branding);
    expect(result.favicon.assetId).toBe("club-favicon");
    expect(result.favicon.storagePath).toBe("branding/org-1/favicon.ico");
    expect(result.brandingRevision).toBe(2);
  });

  it("uses FAVICON_BRANDING_MAP assets.favicon section", () => {
    const result = resolveFaviconBranding(createDefaultBranding());
    expect(result.sectionRef).toBe(FAVICON_BRANDING_MAP[FAVICON_SURFACE_IDS.favicon]);
    expect(result.sectionRef).toBe(BRANDING_CANONICAL_SECTION_REFS.assetsFavicon);
  });

  it("falls back safely for invalid asset snapshots", () => {
    const brokenSnapshot = {
      ...createDefaultBranding(),
      assets: {
        ...createDefaultBranding().assets,
        favicon: {
          assetId: "",
          kind: "favicon",
          storagePath: "",
          contentType: "",
          updatedAt: "invalid",
        },
      },
    };

    const result = resolveFaviconBranding(brokenSnapshot);
    expect(result.favicon).toEqual(createDefaultBranding().assets.favicon);
  });

  it("never throws for unexpected snapshot shapes", () => {
    expect(() => resolveFaviconBranding(undefined)).not.toThrow();
    expect(() => resolveFaviconBranding({} as never)).not.toThrow();
  });
});
