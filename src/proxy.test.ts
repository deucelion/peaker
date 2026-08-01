import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PATHS } from "@/lib/navigation/routeRegistry";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: {
          user: {
            id: "coach-1",
            email: "coach@example.com",
            app_metadata: {},
            user_metadata: { role: "coach" },
          },
        },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: { role: "coach", organization_id: "org-1" },
          })),
        })),
      })),
    })),
  })),
}));

vi.mock("@/lib/auth/roleMatrix", () => ({
  canAccessRoute: vi.fn(() => true),
  getDefaultRouteForRole: vi.fn(() => PATHS.home),
  isPublicRoute: vi.fn(() => false),
}));

vi.mock("@/lib/auth/resolveRouteRole", () => ({
  resolveRouteRoleFromUser: vi.fn(() => "coach"),
}));

vi.mock("@/lib/auth/routeRedirect", () => ({
  fallbackRouteForDeniedAccess: vi.fn(() => PATHS.home),
  logRouteRedirectDecision: vi.fn(),
  safeRedirectPath: vi.fn((_current: string, target: string) => target),
}));

vi.mock("@/lib/auth/coachPermissions", () => ({
  isRouteBlockedForCoach: vi.fn(() => false),
}));

vi.mock("@/lib/auth/athletePermissions", () => ({
  isRouteBlockedForAthlete: vi.fn(() => false),
}));

vi.mock("@/lib/auth/proxyPermissionReads", () => ({
  loadCoachPermissionsForProxy: vi.fn(async () => ({ can_view_reports: true })),
  loadAthletePermissionsForProxy: vi.fn(async () => ({})),
}));

vi.mock("@/lib/auth/proxyRouteFeatureAccess", () => ({
  evaluateProxyRouteFeatureAccess: vi.fn(async () => "allow"),
}));

import { proxy } from "@/proxy";
import { isRouteBlockedForCoach } from "@/lib/auth/coachPermissions";
import { evaluateProxyRouteFeatureAccess } from "@/lib/auth/proxyRouteFeatureAccess";

describe("proxy feature integration order", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not call feature runtime when coach permission denies route", async () => {
    vi.mocked(isRouteBlockedForCoach).mockReturnValueOnce(true);

    const request = new NextRequest(new URL(PATHS.finans, "https://example.com"));
    const response = await proxy(request);

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(evaluateProxyRouteFeatureAccess).not.toHaveBeenCalled();
  });

  it("calls feature runtime only after coach permission passes", async () => {
    const request = new NextRequest(new URL(PATHS.finans, "https://example.com"));
    await proxy(request);

    expect(evaluateProxyRouteFeatureAccess).toHaveBeenCalledWith(PATHS.finans, "org-1");
  });
});
