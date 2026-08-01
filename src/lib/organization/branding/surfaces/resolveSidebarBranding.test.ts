import { describe, expect, it } from "vitest";
import { createDefaultBranding } from "../defaults";
import { mergeBranding } from "../helpers";
import { BRANDING_CANONICAL_SECTION_REFS } from "./types";
import { SIDEBAR_BRANDING_MAP, SIDEBAR_SURFACE_IDS } from "./sidebarBrandingMap";
import { resolveSidebarBranding } from "./resolveSidebarBranding";

describe("resolveSidebarBranding", () => {
  it("returns default sidebar when snapshot is null", () => {
    const result = resolveSidebarBranding(null);
    expect(result.sidebar).toEqual(createDefaultBranding().sidebar);
    expect(result.brandingRevision).toBe(0);
    expect(result.sectionRef).toBe(BRANDING_CANONICAL_SECTION_REFS.sidebar);
  });

  it("returns default sidebar when snapshot is undefined", () => {
    const result = resolveSidebarBranding(undefined);
    expect(result.sidebar).toEqual(createDefaultBranding().sidebar);
  });

  it("returns runtime sidebar from organizationBranding snapshot", () => {
    const branding = mergeBranding(createDefaultBranding(), {
      sidebar: {
        background: "#111111",
        text: "#aaaaaa",
        active: "#ffffff",
      },
      brandingRevision: 6,
    });

    const result = resolveSidebarBranding(branding);
    expect(result.sidebar.background).toBe("#111111");
    expect(result.sidebar.text).toBe("#aaaaaa");
    expect(result.sidebar.active).toBe("#ffffff");
    expect(result.brandingRevision).toBe(6);
  });

  it("uses SIDEBAR_BRANDING_MAP sidebar section instead of hardcoded paths", () => {
    const result = resolveSidebarBranding(createDefaultBranding());
    expect(result.sectionRef).toBe(SIDEBAR_BRANDING_MAP[SIDEBAR_SURFACE_IDS.sidebar]);
    expect(result.sectionRef).toBe(BRANDING_CANONICAL_SECTION_REFS.sidebar);
  });

  it("returns kill-switch default snapshot with revision 0", () => {
    const result = resolveSidebarBranding(createDefaultBranding());
    expect(result.brandingRevision).toBe(0);
    expect(result.sidebar).toEqual(createDefaultBranding().sidebar);
  });

  it("falls back safely for repository-error style snapshots", () => {
    const result = resolveSidebarBranding(createDefaultBranding());
    expect(result.sidebar).toEqual(createDefaultBranding().sidebar);
    expect(result.brandingRevision).toBe(0);
  });

  it("falls back safely for parse-error style incomplete snapshots", () => {
    const brokenSnapshot = {
      ...createDefaultBranding(),
      sidebar: undefined,
    } as unknown as ReturnType<typeof createDefaultBranding>;

    const result = resolveSidebarBranding(brokenSnapshot);
    expect(result.sidebar).toEqual(createDefaultBranding().sidebar);
  });

  it("never throws for unexpected snapshot shapes", () => {
    expect(() => resolveSidebarBranding(null)).not.toThrow();
    expect(() => resolveSidebarBranding({} as never)).not.toThrow();
  });
});
