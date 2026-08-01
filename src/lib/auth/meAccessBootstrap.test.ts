import { describe, expect, it, vi } from "vitest";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";
import { attachOrganizationFeaturesToMeAccessPayload } from "@/lib/auth/meAccessBootstrap";

vi.mock("@/lib/organization/features/runtime/meAccessPayload", () => ({
  resolveOrganizationFeaturesForMeAccess: vi.fn(),
}));

import { resolveOrganizationFeaturesForMeAccess } from "@/lib/organization/features/runtime/meAccessPayload";

describe("attachOrganizationFeaturesToMeAccessPayload", () => {
  it("merges organization feature fields into me-access payload", async () => {
    vi.mocked(resolveOrganizationFeaturesForMeAccess).mockResolvedValueOnce({
      organizationFeatures: createClubProfessionalFeatures(),
      featuresRevision: 0,
    });

    const payload = await attachOrganizationFeaturesToMeAccessPayload("org-1", {
      role: "coach",
      coachPermissions: { can_manage_training_notes: true },
      athletePermissions: null,
    });

    expect(resolveOrganizationFeaturesForMeAccess).toHaveBeenCalledWith("org-1");
    expect(payload.role).toBe("coach");
    expect(payload.coachPermissions).toEqual({ can_manage_training_notes: true });
    expect(payload.organizationFeatures.finance).toBe(true);
    expect(payload.featuresRevision).toBe(0);
  });

  it("passes empty organization id when tenant has no organization", async () => {
    vi.mocked(resolveOrganizationFeaturesForMeAccess).mockResolvedValueOnce({
      organizationFeatures: createClubProfessionalFeatures(),
      featuresRevision: 0,
    });

    await attachOrganizationFeaturesToMeAccessPayload(null, {
      role: "super_admin",
      coachPermissions: null,
      athletePermissions: null,
    });

    expect(resolveOrganizationFeaturesForMeAccess).toHaveBeenCalledWith("");
  });
});
