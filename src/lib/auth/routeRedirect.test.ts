import { describe, expect, it } from "vitest";
import { PATHS, SPORCU_DEFAULT_LANDING_ROUTE } from "@/lib/navigation/routeRegistry";
import {
  resolveManagementFeatureDenyFallback,
  resolveSporcuProxyFallbackRoute,
  safeRedirectPath,
} from "@/lib/auth/routeRedirect";

describe("routeRedirect sporcu fallback", () => {
  it("uses /anket as sporcu default landing constant", () => {
    expect(SPORCU_DEFAULT_LANDING_ROUTE).toBe(PATHS.anket);
  });

  it("resolves /sporcu deny fallback to /anket", () => {
    expect(resolveSporcuProxyFallbackRoute(PATHS.sporcu)).toBe(PATHS.anket);
  });

  it("returns null when already on landing route", () => {
    expect(resolveSporcuProxyFallbackRoute(PATHS.anket)).toBeNull();
    expect(safeRedirectPath(PATHS.anket, PATHS.anket)).toBeNull();
  });
});

describe("routeRedirect management feature deny fallback", () => {
  it("prefers parent path before role default for nested routes", () => {
    expect(resolveManagementFeatureDenyFallback(PATHS.performansWellnessDetay, "admin")).toBe(
      PATHS.performans
    );
  });

  it("falls back to home for top-level denied routes", () => {
    expect(resolveManagementFeatureDenyFallback(PATHS.home, "admin")).toBeNull();
    expect(resolveManagementFeatureDenyFallback(PATHS.performans, "coach")).toBe(PATHS.home);
  });
});
