import { describe, expect, it } from "vitest";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";
import { createInitialBrandingFromMeAccess, createInitialContentThemeTokens } from "@/lib/auth/meAccessServer";
import { createLayoutThemeStyle } from "@/lib/navigation/layoutThemeTokens";
import { createContentThemeStyle } from "@/lib/ui/branding/UI_CONTENT_THEME_VARS";

describe("SSR branding hydration parity", () => {
  it("keeps layout and content token snapshots aligned for default branding", () => {
    const branding = createInitialBrandingFromMeAccess(null);
    const layoutStyle = createLayoutThemeStyle(branding.theme);
    const contentStyle = createContentThemeStyle(branding.theme);
    const contentTokens = createInitialContentThemeTokens(null);

    expect(layoutStyle["--peaker-layout-theme-PRIMARY"]).toBe("#7c3aed");
    expect(contentStyle["--peaker-ui-PRIMARY"]).toBe("#7c3aed");
    expect(contentTokens.PRIMARY).toBe("#7c3aed");
  });

  it("preserves custom primary across SSR-derived snapshots", () => {
    const branding = createInitialBrandingFromMeAccess({
      role: "admin",
      coachPermissions: null,
      athletePermissions: null,
      organizationFeatures: createClubProfessionalFeatures(),
      featuresRevision: 1,
      organizationBranding: {
        ...createDefaultBranding(),
        theme: {
          ...createDefaultBranding().theme,
          primary: "#112233",
        },
      },
      brandingRevision: 4,
    });

    expect(createInitialContentThemeTokens({
      role: "admin",
      coachPermissions: null,
      athletePermissions: null,
      organizationFeatures: createClubProfessionalFeatures(),
      featuresRevision: 1,
      organizationBranding: branding,
      brandingRevision: 4,
    }).PRIMARY).toBe("#112233");
  });
});
