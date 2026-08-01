import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultBranding } from "../defaults";
import { clearOrganizationBrandingProcessCacheForTests } from "./processCache";
import { KILL_SWITCH_BRANDING_REVISION, getOrganizationBranding } from "./getOrganizationBranding";
import { resolveOrganizationBrandingForMeAccess } from "./brandingMeAccessPayload";

vi.mock("./getOrganizationBranding", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./getOrganizationBranding")>();
  return {
    ...actual,
    getOrganizationBranding: vi.fn(actual.getOrganizationBranding),
  };
});

describe("resolveOrganizationBrandingForMeAccess", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearOrganizationBrandingProcessCacheForTests();
    process.env = { ...originalEnv };
    delete process.env.PEAKER_ORG_BRANDING;
    vi.mocked(getOrganizationBranding).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...originalEnv };
  });

  it("returns Peaker default branding and revision 0 when kill switch is OFF", async () => {
    vi.mocked(getOrganizationBranding).mockResolvedValueOnce({
      branding: createDefaultBranding(),
      brandingRevision: KILL_SWITCH_BRANDING_REVISION,
      source: "kill_switch",
    });

    const result = await resolveOrganizationBrandingForMeAccess("org-1");
    expect(result.brandingRevision).toBe(0);
    expect(result.organizationBranding).toEqual(createDefaultBranding());
  });

  it("returns runtime snapshot when kill switch is ON", async () => {
    const runtimeBranding = {
      ...createDefaultBranding(),
      theme: {
        ...createDefaultBranding().theme,
        primaryColor: "#112233",
      },
    };
    vi.mocked(getOrganizationBranding).mockResolvedValueOnce({
      branding: runtimeBranding,
      brandingRevision: 5,
      source: "database",
    });

    const result = await resolveOrganizationBrandingForMeAccess("org-1");
    expect(result.brandingRevision).toBe(5);
    expect(result.organizationBranding.theme.primaryColor).toBe("#112233");
    expect(getOrganizationBranding).toHaveBeenCalledWith("org-1");
  });

  it("falls back safely when runtime throws", async () => {
    vi.mocked(getOrganizationBranding).mockRejectedValueOnce(new Error("unexpected"));

    const result = await resolveOrganizationBrandingForMeAccess("org-1");
    expect(result.brandingRevision).toBe(KILL_SWITCH_BRANDING_REVISION);
    expect(result.organizationBranding).toEqual(createDefaultBranding());
  });

  it("returns repository fallback snapshot without throwing", async () => {
    vi.mocked(getOrganizationBranding).mockResolvedValueOnce({
      branding: createDefaultBranding(),
      brandingRevision: KILL_SWITCH_BRANDING_REVISION,
      source: "repository_error_fallback",
    });

    const result = await resolveOrganizationBrandingForMeAccess("org-1");
    expect(result.brandingRevision).toBe(0);
    expect(result.organizationBranding).toEqual(createDefaultBranding());
  });

  it("returns parse fallback snapshot without throwing", async () => {
    vi.mocked(getOrganizationBranding).mockResolvedValueOnce({
      branding: createDefaultBranding(),
      brandingRevision: KILL_SWITCH_BRANDING_REVISION,
      source: "parse_fallback",
    });

    const result = await resolveOrganizationBrandingForMeAccess("org-1");
    expect(result.brandingRevision).toBe(0);
    expect(result.organizationBranding).toEqual(createDefaultBranding());
  });

  it("exposes MeAccessOrganizationBrandingPayload shape", async () => {
    vi.mocked(getOrganizationBranding).mockResolvedValueOnce({
      branding: createDefaultBranding(),
      brandingRevision: 2,
      source: "database",
    });

    const result = await resolveOrganizationBrandingForMeAccess("org-1");
    expect(result).toEqual({
      organizationBranding: createDefaultBranding(),
      brandingRevision: 2,
    });
  });
});
