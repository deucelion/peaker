import { describe, expect, it } from "vitest";
import {
  BRANDING_CANONICAL_SECTION_REFS,
  BRANDING_CANONICAL_SECTION_REF_LIST,
  BRANDING_SURFACE_KINDS,
  BRANDING_SURFACE_MAP_COUNT,
  BRANDING_SURFACE_MAP_REGISTRY,
  EMAIL_BRANDING_MAP,
  EMAIL_SURFACE_IDS,
  FAVICON_BRANDING_MAP,
  FAVICON_SURFACE_IDS,
  LAYOUT_BRANDING_MAP,
  LAYOUT_SURFACE_IDS,
  LOGO_BRANDING_MAP,
  LOGO_SURFACE_IDS,
  METADATA_BRANDING_MAP,
  METADATA_SURFACE_IDS,
  PDF_BRANDING_MAP,
  PDF_SURFACE_IDS,
  SIDEBAR_BRANDING_MAP,
  SIDEBAR_SURFACE_IDS,
  assertBrandingSurfaceMapCompleteness,
  assertNoDuplicateSurfaceIds,
  assertSurfaceBrandingMapContract,
  assertUniqueSurfaceBrandingMapKeys,
  collectDuplicateSurfaceIdIssues,
  isCanonicalBrandingSectionRef,
} from "./index";

describe("branding surface map contracts", () => {
  it("validates layout branding map", () => {
    expect(() => assertSurfaceBrandingMapContract("LAYOUT_BRANDING_MAP", LAYOUT_BRANDING_MAP)).not.toThrow();
    assertUniqueSurfaceBrandingMapKeys("LAYOUT_SURFACE_IDS", Object.values(LAYOUT_SURFACE_IDS));
  });

  it("validates sidebar branding map", () => {
    expect(() => assertSurfaceBrandingMapContract("SIDEBAR_BRANDING_MAP", SIDEBAR_BRANDING_MAP)).not.toThrow();
    assertUniqueSurfaceBrandingMapKeys("SIDEBAR_SURFACE_IDS", Object.values(SIDEBAR_SURFACE_IDS));
  });

  it("validates logo branding map", () => {
    expect(() => assertSurfaceBrandingMapContract("LOGO_BRANDING_MAP", LOGO_BRANDING_MAP)).not.toThrow();
    assertUniqueSurfaceBrandingMapKeys("LOGO_SURFACE_IDS", Object.values(LOGO_SURFACE_IDS));
  });

  it("validates favicon branding map", () => {
    expect(() => assertSurfaceBrandingMapContract("FAVICON_BRANDING_MAP", FAVICON_BRANDING_MAP)).not.toThrow();
    assertUniqueSurfaceBrandingMapKeys("FAVICON_SURFACE_IDS", Object.values(FAVICON_SURFACE_IDS));
  });

  it("validates pdf branding map", () => {
    expect(() => assertSurfaceBrandingMapContract("PDF_BRANDING_MAP", PDF_BRANDING_MAP)).not.toThrow();
    assertUniqueSurfaceBrandingMapKeys("PDF_SURFACE_IDS", Object.values(PDF_SURFACE_IDS));
  });

  it("validates email branding map", () => {
    expect(() => assertSurfaceBrandingMapContract("EMAIL_BRANDING_MAP", EMAIL_BRANDING_MAP)).not.toThrow();
    assertUniqueSurfaceBrandingMapKeys("EMAIL_SURFACE_IDS", Object.values(EMAIL_SURFACE_IDS));
  });

  it("validates metadata branding map", () => {
    expect(() => assertSurfaceBrandingMapContract("METADATA_BRANDING_MAP", METADATA_BRANDING_MAP)).not.toThrow();
    assertUniqueSurfaceBrandingMapKeys("METADATA_SURFACE_IDS", Object.values(METADATA_SURFACE_IDS));
  });

  it("maps each surface to a single canonical branding section", () => {
    expect(LAYOUT_BRANDING_MAP[LAYOUT_SURFACE_IDS.layout]).toBe(BRANDING_CANONICAL_SECTION_REFS.theme);
    expect(SIDEBAR_BRANDING_MAP[SIDEBAR_SURFACE_IDS.sidebar]).toBe(BRANDING_CANONICAL_SECTION_REFS.sidebar);
    expect(LOGO_BRANDING_MAP[LOGO_SURFACE_IDS.logo]).toBe(BRANDING_CANONICAL_SECTION_REFS.assetsLogo);
    expect(FAVICON_BRANDING_MAP[FAVICON_SURFACE_IDS.favicon]).toBe(
      BRANDING_CANONICAL_SECTION_REFS.assetsFavicon
    );
    expect(PDF_BRANDING_MAP[PDF_SURFACE_IDS.pdf]).toBe(BRANDING_CANONICAL_SECTION_REFS.pdf);
    expect(EMAIL_BRANDING_MAP[EMAIL_SURFACE_IDS.email]).toBe(BRANDING_CANONICAL_SECTION_REFS.email);
    expect(METADATA_BRANDING_MAP[METADATA_SURFACE_IDS.metadata]).toBe(
      BRANDING_CANONICAL_SECTION_REFS.application
    );
  });

  it("ensures map completeness for all branding surface kinds", () => {
    expect(BRANDING_SURFACE_MAP_COUNT).toBe(Object.keys(BRANDING_SURFACE_KINDS).length);
    expect(() =>
      assertBrandingSurfaceMapCompleteness(BRANDING_SURFACE_MAP_REGISTRY, BRANDING_SURFACE_MAP_COUNT)
    ).not.toThrow();
  });

  it("rejects duplicate surface ids across maps", () => {
    expect(collectDuplicateSurfaceIdIssues(BRANDING_SURFACE_MAP_REGISTRY)).toEqual([]);
    expect(() => assertNoDuplicateSurfaceIds(BRANDING_SURFACE_MAP_REGISTRY)).not.toThrow();
  });

  it("fails contract validation for unknown branding section strings", () => {
    expect(() =>
      assertSurfaceBrandingMapContract("TEST_MAP", {
        "surface:branding.test": "not_a_real_section" as never,
      })
    ).toThrow(/unknown branding section/i);
  });

  it("fails contract validation for duplicate map keys", () => {
    expect(() => assertUniqueSurfaceBrandingMapKeys("TEST_MAP", ["a", "a"])).toThrow(/duplicate keys/i);
  });

  it("fails duplicate surface id validation when the same id appears in multiple maps", () => {
    expect(() =>
      assertNoDuplicateSurfaceIds([
        { mapName: "MAP_A", map: { "surface:branding.layout": BRANDING_CANONICAL_SECTION_REFS.theme } },
        { mapName: "MAP_B", map: { "surface:branding.layout": BRANDING_CANONICAL_SECTION_REFS.sidebar } },
      ])
    ).toThrow(/duplicate surface id/i);
  });

  it("fails completeness validation when surface count is insufficient", () => {
    expect(() =>
      assertBrandingSurfaceMapCompleteness(
        [{ mapName: "LAYOUT_BRANDING_MAP", map: LAYOUT_BRANDING_MAP }],
        BRANDING_SURFACE_MAP_COUNT
      )
    ).toThrow(/completeness violation/i);
  });
});

describe("branding surface map magic string guard", () => {
  it("uses only canonical section refs in all map values", () => {
    const canonicalValues = new Set(BRANDING_CANONICAL_SECTION_REF_LIST);
    for (const { map } of BRANDING_SURFACE_MAP_REGISTRY) {
      for (const section of Object.values(map)) {
        expect(canonicalValues.has(section)).toBe(true);
        expect(isCanonicalBrandingSectionRef(section)).toBe(true);
      }
    }
  });

  it("uses canonical section ref constants for every expected surface mapping", () => {
    const canonicalValues = new Set(BRANDING_CANONICAL_SECTION_REF_LIST);
    for (const section of Object.values(BRANDING_CANONICAL_SECTION_REFS)) {
      expect(canonicalValues.has(section)).toBe(true);
    }
  });
});
