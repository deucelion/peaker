import { describe, expect, it, vi } from "vitest";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";
import {
  createInitialBrandingFromMeAccess,
  createInitialContentThemeTokens,
  isSsrBrandingEnabled,
  loadMeAccessServerSnapshot,
} from "./meAccessServer";

vi.mock("@/lib/auth/meAccessBootstrap", () => ({
  resolveMeAccessApiPayloadWithRequestCache: vi.fn(),
}));

import { resolveMeAccessApiPayloadWithRequestCache } from "@/lib/auth/meAccessBootstrap";

describe("meAccessServer", () => {
  it("returns null when SSR branding is disabled", async () => {
    vi.stubEnv("PEAKER_SSR_BRANDING", "0");
    await expect(loadMeAccessServerSnapshot()).resolves.toBeNull();
    expect(resolveMeAccessApiPayloadWithRequestCache).not.toHaveBeenCalled();
  });

  it("loads server snapshot when session payload resolves", async () => {
    vi.stubEnv("PEAKER_SSR_BRANDING", "1");
    vi.mocked(resolveMeAccessApiPayloadWithRequestCache).mockResolvedValueOnce({
      role: "admin",
      coachPermissions: null,
      athletePermissions: null,
      organizationFeatures: createClubProfessionalFeatures(),
      featuresRevision: 2,
      organizationBranding: createDefaultBranding(),
      brandingRevision: 3,
    });

    const snapshot = await loadMeAccessServerSnapshot();
    expect(snapshot?.featuresRevision).toBe(2);
    expect(snapshot?.brandingRevision).toBe(3);
  });

  it("derives initial branding and content tokens from server snapshot", () => {
    const branding = createInitialBrandingFromMeAccess({
      role: "admin",
      coachPermissions: null,
      athletePermissions: null,
      organizationFeatures: createClubProfessionalFeatures(),
      featuresRevision: 0,
      organizationBranding: createDefaultBranding(),
      brandingRevision: 0,
    });

    expect(branding.theme.primary).toBe("#7c3aed");
    expect(createInitialContentThemeTokens({
      role: "admin",
      coachPermissions: null,
      athletePermissions: null,
      organizationFeatures: createClubProfessionalFeatures(),
      featuresRevision: 0,
      organizationBranding: branding,
      brandingRevision: 0,
    }).PRIMARY).toBe("#7c3aed");
  });

  it("defaults SSR branding to enabled", () => {
    vi.stubEnv("PEAKER_SSR_BRANDING", undefined);
    expect(isSsrBrandingEnabled()).toBe(true);
  });
});
