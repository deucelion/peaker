import { describe, expect, it } from "vitest";
import { createDefaultBranding } from "../defaults";
import { mergeBranding } from "../helpers";
import { BRANDING_CANONICAL_SECTION_REFS } from "./types";
import { EMAIL_BRANDING_MAP, EMAIL_SURFACE_IDS } from "./emailBrandingMap";
import { resolveEmailBranding } from "./resolveEmailBranding";

describe("resolveEmailBranding", () => {
  it("returns default email title when snapshot is null", () => {
    const result = resolveEmailBranding(null);
    expect(result.title).toBe("PEAKER");
    expect(result.brandingRevision).toBe(0);
    expect(result.sectionRef).toBe(BRANDING_CANONICAL_SECTION_REFS.email);
  });

  it("returns runtime email title from organizationBranding snapshot", () => {
    const branding = mergeBranding(createDefaultBranding(), {
      email: { title: "Atlas Club" },
      brandingRevision: 3,
    });

    const result = resolveEmailBranding(branding);
    expect(result.title).toBe("Atlas Club");
    expect(result.brandingRevision).toBe(3);
  });

  it("uses EMAIL_BRANDING_MAP email section", () => {
    const result = resolveEmailBranding(createDefaultBranding());
    expect(result.sectionRef).toBe(EMAIL_BRANDING_MAP[EMAIL_SURFACE_IDS.email]);
    expect(result.sectionRef).toBe(BRANDING_CANONICAL_SECTION_REFS.email);
  });

  it("falls back safely for invalid payload snapshots", () => {
    const brokenSnapshot = {
      ...createDefaultBranding(),
      email: { title: "" },
    };

    const result = resolveEmailBranding(brokenSnapshot);
    expect(result.title).toBe("PEAKER");
  });

  it("never throws for unexpected snapshot shapes", () => {
    expect(() => resolveEmailBranding(undefined)).not.toThrow();
    expect(() => resolveEmailBranding({} as never)).not.toThrow();
  });
});
