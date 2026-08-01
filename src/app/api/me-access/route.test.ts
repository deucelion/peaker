import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";

vi.mock("@/lib/auth/resolveSessionActor", () => ({
  resolveSessionActor: vi.fn(),
}));

vi.mock("@/lib/auth/coachPermissions", () => ({
  getCoachPermissions: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/organization/features/runtime/meAccessPayload", () => ({
  resolveOrganizationFeaturesForMeAccess: vi.fn(),
}));

vi.mock("@/lib/organization/branding/runtime/brandingMeAccessPayload", () => ({
  resolveOrganizationBrandingForMeAccess: vi.fn(),
}));

import { GET } from "@/app/api/me-access/route";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { getCoachPermissions } from "@/lib/auth/coachPermissions";
import { resolveOrganizationBrandingForMeAccess } from "@/lib/organization/branding/runtime/brandingMeAccessPayload";
import { resolveOrganizationFeaturesForMeAccess } from "@/lib/organization/features/runtime/meAccessPayload";

describe("/api/me-access", () => {
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
  });

  it("returns 401 when session is missing", async () => {
    vi.mocked(resolveSessionActor).mockResolvedValueOnce({ error: "unauthorized" });

    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("includes organizationFeatures and featuresRevision for coach payload", async () => {
    vi.mocked(resolveSessionActor).mockResolvedValueOnce({
      actor: {
        id: "coach-1",
        role: "coach",
        organizationId: "org-1",
        isActive: true,
        fullName: "Coach",
      },
    });
    vi.mocked(getCoachPermissions).mockResolvedValueOnce({ can_manage_training_notes: true });
    vi.mocked(resolveOrganizationFeaturesForMeAccess).mockResolvedValueOnce({
      organizationFeatures: {
        ...createClubProfessionalFeatures(),
        finance: false,
      },
      featuresRevision: 3,
    });
    vi.mocked(resolveOrganizationBrandingForMeAccess).mockResolvedValueOnce({
      organizationBranding: {
        ...createDefaultBranding(),
        theme: {
          ...createDefaultBranding().theme,
          primaryColor: "#445566",
        },
      },
      brandingRevision: 7,
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.role).toBe("coach");
    expect(body.coachPermissions).toEqual({ can_manage_training_notes: true });
    expect(body.organizationFeatures.finance).toBe(false);
    expect(body.featuresRevision).toBe(3);
    expect(body.organizationBranding.theme.primaryColor).toBe("#445566");
    expect(body.brandingRevision).toBe(7);
    expect(resolveOrganizationFeaturesForMeAccess).toHaveBeenCalledWith("org-1");
    expect(resolveOrganizationBrandingForMeAccess).toHaveBeenCalledWith("org-1");
  });

  it("includes organizationBranding and brandingRevision for athlete payload", async () => {
    vi.mocked(resolveSessionActor).mockResolvedValueOnce({
      actor: {
        id: "athlete-1",
        role: "sporcu",
        organizationId: "org-2",
        isActive: true,
        fullName: "Athlete",
      },
    });
    vi.mocked(resolveOrganizationBrandingForMeAccess).mockResolvedValueOnce({
      organizationBranding: createDefaultBranding(),
      brandingRevision: 2,
    });

    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null });
    const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
    vi.mocked(createSupabaseAdminClient).mockReturnValue({ from: mockFrom } as never);

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.role).toBe("sporcu");
    expect(body.organizationBranding).toEqual(createDefaultBranding());
    expect(body.brandingRevision).toBe(2);
    expect(resolveOrganizationBrandingForMeAccess).toHaveBeenCalledWith("org-2");
  });

  it("still returns 200 when feature and branding resolvers use kill-switch fallback", async () => {
    vi.mocked(resolveSessionActor).mockResolvedValueOnce({
      actor: {
        id: "admin-1",
        role: "admin",
        organizationId: null,
        isActive: true,
        fullName: "Admin",
      },
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.organizationFeatures).toEqual(createClubProfessionalFeatures());
    expect(body.featuresRevision).toBe(0);
    expect(body.organizationBranding).toEqual(createDefaultBranding());
    expect(body.brandingRevision).toBe(0);
    expect(resolveOrganizationFeaturesForMeAccess).toHaveBeenCalledWith("");
    expect(resolveOrganizationBrandingForMeAccess).toHaveBeenCalledWith("");
  });

  it("preserves existing payload fields alongside branding fields", async () => {
    vi.mocked(resolveSessionActor).mockResolvedValueOnce({
      actor: {
        id: "admin-1",
        role: "admin",
        organizationId: "org-9",
        isActive: true,
        fullName: "Admin",
      },
    });

    const response = await GET();
    const body = await response.json();

    expect(Object.keys(body).sort()).toEqual(
      [
        "athletePermissions",
        "brandingRevision",
        "coachPermissions",
        "featuresRevision",
        "organizationBranding",
        "organizationFeatures",
        "role",
      ].sort()
    );
  });
});
