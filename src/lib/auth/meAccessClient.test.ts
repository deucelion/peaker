import { describe, expect, it } from "vitest";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import { readOrganizationBrandingSnapshot } from "./meAccessClient";

describe("readOrganizationBrandingSnapshot", () => {
  it("falls back to default branding when organizationBranding is null", () => {
    const snapshot = readOrganizationBrandingSnapshot(null);
    expect(snapshot).toEqual(createDefaultBranding());
  });

  it("falls back to default branding when theme is missing", () => {
    const snapshot = readOrganizationBrandingSnapshot({
      brandingRevision: 2,
    });
    expect(snapshot).toEqual(createDefaultBranding());
  });

  it("returns runtime branding snapshot when theme is present", () => {
    const branding = createDefaultBranding();
    const snapshot = readOrganizationBrandingSnapshot({
      ...branding,
      theme: {
        ...branding.theme,
        primary: "#101010",
      },
    });
    expect(snapshot.theme.primary).toBe("#101010");
  });
});
