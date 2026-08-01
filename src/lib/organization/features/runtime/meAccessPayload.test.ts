import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClubProfessionalFeatures } from "../presets";
import { clearOrganizationFeaturesProcessCacheForTests } from "./processCache";
import { KILL_SWITCH_FEATURES_REVISION, getOrganizationFeatures } from "./getOrganizationFeatures";
import { resolveOrganizationFeaturesForMeAccess } from "./meAccessPayload";

vi.mock("./getOrganizationFeatures", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./getOrganizationFeatures")>();
  return {
    ...actual,
    getOrganizationFeatures: vi.fn(actual.getOrganizationFeatures),
  };
});

describe("resolveOrganizationFeaturesForMeAccess", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearOrganizationFeaturesProcessCacheForTests();
    process.env = { ...originalEnv };
    delete process.env.PEAKER_ORG_FEATURES;
    vi.mocked(getOrganizationFeatures).mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...originalEnv };
  });

  it("returns Club Professional and revision 0 when kill switch is OFF", async () => {
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createClubProfessionalFeatures(),
      featuresRevision: KILL_SWITCH_FEATURES_REVISION,
      source: "kill_switch",
    });

    const result = await resolveOrganizationFeaturesForMeAccess("org-1");
    expect(result.featuresRevision).toBe(0);
    expect(result.organizationFeatures.finance).toBe(true);
    expect(result.organizationFeatures).toEqual(createClubProfessionalFeatures());
  });

  it("returns runtime snapshot when kill switch is ON", async () => {
    const runtimeFeatures = {
      ...createClubProfessionalFeatures(),
      finance: false,
    };
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: runtimeFeatures,
      featuresRevision: 4,
      source: "database",
    });

    const result = await resolveOrganizationFeaturesForMeAccess("org-1");
    expect(result.featuresRevision).toBe(4);
    expect(result.organizationFeatures.finance).toBe(false);
    expect(getOrganizationFeatures).toHaveBeenCalledWith("org-1");
  });

  it("falls back safely when runtime throws", async () => {
    vi.mocked(getOrganizationFeatures).mockRejectedValueOnce(new Error("unexpected"));

    const result = await resolveOrganizationFeaturesForMeAccess("org-1");
    expect(result.featuresRevision).toBe(KILL_SWITCH_FEATURES_REVISION);
    expect(result.organizationFeatures).toEqual(createClubProfessionalFeatures());
  });

  it("returns repository fallback snapshot without throwing", async () => {
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createClubProfessionalFeatures(),
      featuresRevision: KILL_SWITCH_FEATURES_REVISION,
      source: "repository_error_fallback",
    });

    const result = await resolveOrganizationFeaturesForMeAccess("org-1");
    expect(result.featuresRevision).toBe(0);
    expect(result.organizationFeatures).toEqual(createClubProfessionalFeatures());
  });
});
