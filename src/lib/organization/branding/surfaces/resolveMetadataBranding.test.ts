import { describe, expect, it } from "vitest";
import { createDefaultBranding } from "../defaults";
import { mergeBranding } from "../helpers";
import { BRANDING_CANONICAL_SECTION_REFS } from "./types";
import { METADATA_BRANDING_MAP, METADATA_SURFACE_IDS } from "./metadataBrandingMap";
import { resolveMetadataBranding } from "./resolveMetadataBranding";

describe("resolveMetadataBranding", () => {
  it("returns default appName and shortName when snapshot is null", () => {
    const result = resolveMetadataBranding(null);
    expect(result.appName).toBe("PEAKER");
    expect(result.shortName).toBe("Peaker");
    expect(result.sectionRef).toBe(BRANDING_CANONICAL_SECTION_REFS.application);
  });

  it("returns runtime application metadata from organizationBranding snapshot", () => {
    const branding = mergeBranding(createDefaultBranding(), {
      application: {
        appName: "Atlas Club",
        shortName: "Atlas",
      },
      brandingRevision: 5,
    });

    const result = resolveMetadataBranding(branding);
    expect(result.appName).toBe("Atlas Club");
    expect(result.shortName).toBe("Atlas");
    expect(result.brandingRevision).toBe(5);
  });

  it("uses METADATA_BRANDING_MAP application section", () => {
    const result = resolveMetadataBranding(createDefaultBranding());
    expect(result.sectionRef).toBe(METADATA_BRANDING_MAP[METADATA_SURFACE_IDS.metadata]);
    expect(result.sectionRef).toBe(BRANDING_CANONICAL_SECTION_REFS.application);
  });

  it("falls back safely for invalid payload snapshots", () => {
    const brokenSnapshot = {
      ...createDefaultBranding(),
      application: {
        appName: "",
        shortName: "",
      },
    };

    const result = resolveMetadataBranding(brokenSnapshot);
    expect(result.appName).toBe("PEAKER");
    expect(result.shortName).toBe("Peaker");
  });

  it("never throws for unexpected snapshot shapes", () => {
    expect(() => resolveMetadataBranding(undefined)).not.toThrow();
    expect(() => resolveMetadataBranding({} as never)).not.toThrow();
  });
});
