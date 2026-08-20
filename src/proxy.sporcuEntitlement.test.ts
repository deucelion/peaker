import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PATHS } from "@/lib/navigation/routeRegistry";
import { canAccessRoute } from "@/lib/auth/roleMatrix";

function createSupabaseMock(profile: { role: string; organization_id: string | null }) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: {
            id: "user-1",
            email: "user@example.com",
            app_metadata: {},
            user_metadata: { role: profile.role },
          },
        },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: profile })),
        })),
      })),
    })),
  };
}

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => createSupabaseMock({ role: "sporcu", organization_id: "org-1" })),
}));

vi.mock("@/lib/auth/resolveRouteRole", () => ({
  resolveRouteRoleFromUser: vi.fn((_user, profileRole: string | null) => profileRole),
}));

vi.mock("@/lib/auth/coachPermissions", () => ({
  isRouteBlockedForCoach: vi.fn(() => false),
}));

vi.mock("@/lib/auth/athletePermissions", () => ({
  isRouteBlockedForAthlete: vi.fn(() => false),
}));

vi.mock("@/lib/auth/proxyPermissionReads", () => ({
  loadCoachPermissionsForProxy: vi.fn(async () => ({})),
  loadAthletePermissionsForProxy: vi.fn(async () => ({
    can_view_rpe_entry: true,
    can_view_development_profile: true,
  })),
}));

vi.mock("@/lib/auth/proxyRouteFeatureAccess", () => ({
  evaluateProxyRouteFeatureAccess: vi.fn(async () => "allow"),
}));

import { createServerClient } from "@supabase/ssr";
import { proxy } from "@/proxy";
import { evaluateProxyRouteFeatureAccess } from "@/lib/auth/proxyRouteFeatureAccess";
import { isRouteBlockedForAthlete } from "@/lib/auth/athletePermissions";

describe("proxy sporcu entitlement hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createServerClient).mockImplementation(() =>
      createSupabaseMock({ role: "sporcu", organization_id: "org-1" })
    );
    vi.mocked(evaluateProxyRouteFeatureAccess).mockResolvedValue("allow");
    vi.mocked(isRouteBlockedForAthlete).mockReturnValue(false);
  });

  it("redirects sporcu from /sporcu to /anket when development_hub feature is denied", async () => {
    vi.mocked(evaluateProxyRouteFeatureAccess).mockResolvedValueOnce("deny");

    const request = new NextRequest(new URL(PATHS.sporcu, "https://example.com"));
    const response = await proxy(request);

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(response.headers.get("location")).toBe(new URL(PATHS.anket, "https://example.com").toString());
  });

  it("does not fail-open /sporcu when development_hub is denied (returns redirect, not 200)", async () => {
    vi.mocked(evaluateProxyRouteFeatureAccess).mockResolvedValueOnce("deny");

    const request = new NextRequest(new URL(PATHS.sporcu, "https://example.com"));
    const response = await proxy(request);

    expect(response.status).not.toBe(200);
  });

  it("returns 403 when sporcu is already on /anket and fallback would loop", async () => {
    vi.mocked(isRouteBlockedForAthlete).mockReturnValueOnce(true);

    const request = new NextRequest(new URL(PATHS.anket, "https://example.com"));
    const response = await proxy(request);

    expect(response.status).toBe(403);
  });

  it("redirects sporcu from RBAC-allowed but feature-denied route to /anket", async () => {
    vi.mocked(evaluateProxyRouteFeatureAccess).mockResolvedValueOnce("deny");
    expect(canAccessRoute("sporcu", PATHS.bildirimler)).toBe(true);

    const request = new NextRequest(new URL(PATHS.bildirimler, "https://example.com"));
    const response = await proxy(request);

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.headers.get("location")).toContain(PATHS.anket);
  });

  it("allows sporcu on /anket when feature runtime allows", async () => {
    const request = new NextRequest(new URL(PATHS.anket, "https://example.com"));
    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(evaluateProxyRouteFeatureAccess).toHaveBeenCalledWith(PATHS.anket, "org-1");
  });

  it("allows admin on /sporcu when RBAC and feature gate pass", async () => {
    vi.mocked(createServerClient).mockImplementationOnce(() =>
      createSupabaseMock({ role: "admin", organization_id: "org-1" })
    );

    const request = new NextRequest(new URL(PATHS.sporcu, "https://example.com"));
    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(canAccessRoute("admin", PATHS.sporcu)).toBe(true);
  });

  it("allows super_admin on /super-admin without feature deny blocking RBAC bypass path", async () => {
    vi.mocked(createServerClient).mockImplementationOnce(() =>
      createSupabaseMock({ role: "super_admin", organization_id: null })
    );
    vi.mocked(evaluateProxyRouteFeatureAccess).mockResolvedValueOnce("allow");

    const request = new NextRequest(new URL(PATHS.superAdmin, "https://example.com"));
    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(canAccessRoute("super_admin", PATHS.superAdmin)).toBe(true);
  });
});
