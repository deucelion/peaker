import { describe, expect, it } from "vitest";
import { PATHS, SPORCU_DEFAULT_LANDING_ROUTE } from "@/lib/navigation/routeRegistry";
import { resolveSporcuProxyFallbackRoute, safeRedirectPath } from "@/lib/auth/routeRedirect";

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
