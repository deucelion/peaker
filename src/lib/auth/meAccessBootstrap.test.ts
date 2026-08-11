import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";

vi.mock("@/lib/organization/features/runtime/meAccessPayload", () => ({
  resolveOrganizationFeaturesForMeAccess: vi.fn(),
}));

vi.mock("@/lib/organization/branding/runtime/brandingMeAccessPayload", () => ({
  resolveOrganizationBrandingForMeAccess: vi.fn(),
}));

vi.mock("@/lib/organization/branding/runtime/requestCache", () => ({
  runWithOrganizationBrandingRequestCacheAsync: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

vi.mock("@/lib/organization/features/runtime/requestCache", () => ({
  runWithOrganizationFeaturesRequestCacheAsync: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

import {
  attachOrganizationFeaturesToMeAccessPayload,
  resolveMeAccessApiPayloadWithRequestCache,
} from "@/lib/auth/meAccessBootstrap";
import { resolveOrganizationBrandingForMeAccess } from "@/lib/organization/branding/runtime/brandingMeAccessPayload";
import { runWithOrganizationBrandingRequestCacheAsync } from "@/lib/organization/branding/runtime/requestCache";
import { resolveOrganizationFeaturesForMeAccess } from "@/lib/organization/features/runtime/meAccessPayload";
import { runWithOrganizationFeaturesRequestCacheAsync } from "@/lib/organization/features/runtime/requestCache";

vi.mock("@/lib/auth/resolveSessionActor", () => ({
  resolveSessionActor: vi.fn(),
}));

vi.mock("@/lib/auth/coachPermissions", () => ({
  getCoachPermissions: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { getCoachPermissions } from "@/lib/auth/coachPermissions";

describe("attachOrganizationFeaturesToMeAccessPayload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveOrganizationBrandingForMeAccess).mockResolvedValue({
      organizationBranding: createDefaultBranding(),
      brandingRevision: 0,
    });
  });

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
    expect(resolveOrganizationBrandingForMeAccess).toHaveBeenCalledWith("org-1");
    expect(payload.role).toBe("coach");
    expect(payload.coachPermissions).toEqual({ can_manage_training_notes: true });
    expect(payload.organizationFeatures.finance).toBe(true);
    expect(payload.featuresRevision).toBe(0);
    expect(payload.organizationBranding).toEqual(createDefaultBranding());
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
    expect(resolveOrganizationBrandingForMeAccess).toHaveBeenCalledWith("");
  });
});

describe("resolveMeAccessApiPayloadWithRequestCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveOrganizationFeaturesForMeAccess).mockResolvedValue({
      organizationFeatures: createClubProfessionalFeatures(),
      featuresRevision: 0,
    });
    vi.mocked(resolveOrganizationBrandingForMeAccess).mockResolvedValue({
      organizationBranding: createDefaultBranding(),
      brandingRevision: 0,
    });
    vi.mocked(resolveSessionActor).mockResolvedValue({
      actor: {
        id: "coach-1",
        role: "coach",
        organizationId: "org-1",
        isActive: true,
        fullName: "Coach",
      },
    });
    vi.mocked(getCoachPermissions).mockResolvedValue({ can_manage_training_notes: true });
  });

  it("wraps branding and features resolvers in request cache scopes", async () => {
    const payload = await resolveMeAccessApiPayloadWithRequestCache();

    expect(runWithOrganizationBrandingRequestCacheAsync).toHaveBeenCalledTimes(1);
    expect(runWithOrganizationFeaturesRequestCacheAsync).toHaveBeenCalledTimes(1);
    expect(payload).toMatchObject({
      role: "coach",
      featuresRevision: 0,
      brandingRevision: 0,
    });
  });
});
