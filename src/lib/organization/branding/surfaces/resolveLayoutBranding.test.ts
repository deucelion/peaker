import { describe, expect, it } from "vitest";
import { createDefaultBranding } from "../defaults";
import { mergeBranding } from "../helpers";
import { BRANDING_CANONICAL_SECTION_REFS } from "./types";
import { LAYOUT_BRANDING_MAP, LAYOUT_SURFACE_IDS } from "./layoutBrandingMap";
import { resolveLayoutBranding } from "./resolveLayoutBranding";

describe("resolveLayoutBranding", () => {
  it("returns default branding theme when snapshot is null", () => {
    const result = resolveLayoutBranding(null);
    expect(result.theme).toEqual(createDefaultBranding().theme);
    expect(result.brandingRevision).toBe(0);
    expect(result.sectionRef).toBe(BRANDING_CANONICAL_SECTION_REFS.theme);
  });

  it("returns default branding theme when snapshot is undefined", () => {
    const result = resolveLayoutBranding(undefined);
    expect(result.theme).toEqual(createDefaultBranding().theme);
  });

  it("returns runtime branding theme from organizationBranding snapshot", () => {
    const branding = mergeBranding(createDefaultBranding(), {
      theme: {
        ...createDefaultBranding().theme,
        primary: "#112233",
        background: "#010101",
      },
      brandingRevision: 4,
    });

    const result = resolveLayoutBranding(branding);
    expect(result.theme.primary).toBe("#112233");
    expect(result.theme.background).toBe("#010101");
    expect(result.brandingRevision).toBe(4);
  });

  it("uses LAYOUT_BRANDING_MAP theme section instead of hardcoded paths", () => {
    const result = resolveLayoutBranding(createDefaultBranding());
    expect(result.sectionRef).toBe(LAYOUT_BRANDING_MAP[LAYOUT_SURFACE_IDS.layout]);
    expect(result.sectionRef).toBe(BRANDING_CANONICAL_SECTION_REFS.theme);
  });

  it("returns kill-switch default snapshot with revision 0", () => {
    const killSwitchSnapshot = createDefaultBranding();
    const result = resolveLayoutBranding(killSwitchSnapshot);
    expect(result.brandingRevision).toBe(0);
    expect(result.theme).toEqual(killSwitchSnapshot.theme);
  });

  it("falls back safely for repository-error style snapshots", () => {
    const fallbackSnapshot = createDefaultBranding();
    const result = resolveLayoutBranding(fallbackSnapshot);
    expect(result.theme).toEqual(fallbackSnapshot.theme);
    expect(result.brandingRevision).toBe(0);
  });

  it("falls back safely for parse-error style incomplete snapshots", () => {
    const brokenSnapshot = {
      ...createDefaultBranding(),
      theme: undefined,
    } as unknown as ReturnType<typeof createDefaultBranding>;

    const result = resolveLayoutBranding(brokenSnapshot);
    expect(result.theme).toEqual(createDefaultBranding().theme);
  });

  it("never throws for unexpected snapshot shapes", () => {
    expect(() => resolveLayoutBranding(null)).not.toThrow();
    expect(() => resolveLayoutBranding({} as never)).not.toThrow();
  });
});
