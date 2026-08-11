import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";
import {
  fetchMeAccessClient,
  readMeAccessClientCache,
  resetMeAccessClientCache,
  seedMeAccessClientCache,
} from "./meAccessClient";

describe("fetchMeAccessClient dedupe", () => {
  beforeEach(() => {
    resetMeAccessClientCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetMeAccessClientCache();
  });

  it("deduplicates concurrent requests into a single network call", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        role: "admin",
        coachPermissions: null,
        athletePermissions: null,
        organizationFeatures: createClubProfessionalFeatures(),
        featuresRevision: 0,
        organizationBranding: createDefaultBranding(),
        brandingRevision: 0,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const [first, second] = await Promise.all([fetchMeAccessClient(), fetchMeAccessClient()]);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns cached payload without a second network call", async () => {
    seedMeAccessClientCache({
      ok: true,
      role: "admin",
      coachPermissions: null,
      athletePermissions: null,
      organizationFeatures: createClubProfessionalFeatures(),
      featuresRevision: 1,
      organizationBranding: createDefaultBranding(),
      brandingRevision: 1,
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const payload = await fetchMeAccessClient();
    expect(payload.ok).toBe(true);
    if (payload.ok) {
      expect(payload.featuresRevision).toBe(1);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(readMeAccessClientCache()).not.toBeNull();
  });
});
