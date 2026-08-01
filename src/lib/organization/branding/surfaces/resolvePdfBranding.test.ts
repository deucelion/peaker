import { describe, expect, it } from "vitest";
import { createDefaultBranding } from "../defaults";
import { mergeBranding } from "../helpers";
import { BRANDING_CANONICAL_SECTION_REFS } from "./types";
import { PDF_BRANDING_MAP, PDF_SURFACE_IDS } from "./pdfBrandingMap";
import { resolvePdfBranding } from "./resolvePdfBranding";

describe("resolvePdfBranding", () => {
  it("returns default pdf title when snapshot is null", () => {
    const result = resolvePdfBranding(null);
    expect(result.title).toBe("PEAKER Rapor");
    expect(result.brandingRevision).toBe(0);
    expect(result.sectionRef).toBe(BRANDING_CANONICAL_SECTION_REFS.pdf);
  });

  it("returns runtime pdf title from organizationBranding snapshot", () => {
    const branding = mergeBranding(createDefaultBranding(), {
      pdf: { title: "Atlas Club Rapor" },
      brandingRevision: 4,
    });

    const result = resolvePdfBranding(branding);
    expect(result.title).toBe("Atlas Club Rapor");
    expect(result.brandingRevision).toBe(4);
  });

  it("uses PDF_BRANDING_MAP pdf section instead of hardcoded paths", () => {
    const result = resolvePdfBranding(createDefaultBranding());
    expect(result.sectionRef).toBe(PDF_BRANDING_MAP[PDF_SURFACE_IDS.pdf]);
    expect(result.sectionRef).toBe(BRANDING_CANONICAL_SECTION_REFS.pdf);
  });

  it("falls back safely for repository-error style snapshots", () => {
    const result = resolvePdfBranding(createDefaultBranding());
    expect(result.title).toBe("PEAKER Rapor");
    expect(result.brandingRevision).toBe(0);
  });

  it("falls back safely for parse-error style incomplete snapshots", () => {
    const brokenSnapshot = {
      ...createDefaultBranding(),
      pdf: { title: "" },
    };

    const result = resolvePdfBranding(brokenSnapshot);
    expect(result.title).toBe("PEAKER Rapor");
  });

  it("never throws for unexpected snapshot shapes", () => {
    expect(() => resolvePdfBranding(undefined)).not.toThrow();
    expect(() => resolvePdfBranding({} as never)).not.toThrow();
  });
});
