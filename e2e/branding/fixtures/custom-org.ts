import { mergeBranding } from "../../../src/lib/organization/branding/helpers";
import { createDefaultBranding } from "../../../src/lib/organization/branding/defaults";
import { createClubProfessionalFeatures } from "../../../src/lib/organization/features/presets";
import type { MeAccessApiPayload } from "../../../src/lib/auth/meAccessBootstrap";

export const CUSTOM_ORG_A_PRIMARY = "#112233";
export const CUSTOM_ORG_B_PRIMARY = "#445566";

export function buildCustomOrganizationBranding(primary: string) {
  return mergeBranding(createDefaultBranding(), {
    brandingRevision: 3,
    theme: {
      ...createDefaultBranding().theme,
      primary,
      accent: primary,
    },
  });
}

export function buildMeAccessPayload(primary: string): MeAccessApiPayload {
  return {
    role: "admin",
    coachPermissions: null,
    athletePermissions: null,
    organizationFeatures: createClubProfessionalFeatures(),
    featuresRevision: 1,
    organizationBranding: buildCustomOrganizationBranding(primary),
    brandingRevision: 3,
  };
}

export async function readContentPrimaryVar(page: import("@playwright/test").Page): Promise<string> {
  return page.locator("[data-peaker-ui-content-root]").evaluate((el) => {
    const inline = el.style.getPropertyValue("--peaker-ui-PRIMARY").trim();
    if (inline) {
      return inline.toLowerCase();
    }
    return getComputedStyle(el).getPropertyValue("--peaker-ui-PRIMARY").trim().toLowerCase();
  });
}
