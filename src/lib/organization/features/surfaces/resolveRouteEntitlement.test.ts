import { describe, expect, it } from "vitest";
import { PATHS } from "@/lib/navigation/routeRegistry";
import { ENTITLEMENT_KEYS } from "../keys";
import { resolveRouteEntitlementKey } from "./resolveRouteEntitlement";

const ATHLETE_ID = "550e8400-e29b-41d4-a716-446655440000";
const PACKAGE_ID = "660e8400-e29b-41d4-a716-446655440001";

describe("resolveRouteEntitlementKey", () => {
  it("resolves exact static routes from route map", () => {
    expect(resolveRouteEntitlementKey(PATHS.finans)).toBe(ENTITLEMENT_KEYS.finance);
    expect(resolveRouteEntitlementKey(PATHS.auditLog)).toBe(ENTITLEMENT_KEYS.audit);
    expect(resolveRouteEntitlementKey(PATHS.home)).toBe(ENTITLEMENT_KEYS.core);
  });

  it("resolves prefix routes from route map", () => {
    expect(resolveRouteEntitlementKey(`${PATHS.performans}/detay`)).toBe(ENTITLEMENT_KEYS.insightPerformance);
    expect(resolveRouteEntitlementKey(`${PATHS.muhasebeFinans}/ozet`)).toBe(ENTITLEMENT_KEYS.finance);
  });

  it("returns null for ungated routes", () => {
    expect(resolveRouteEntitlementKey("/login")).toBeNull();
    expect(resolveRouteEntitlementKey("/org-durumu")).toBeNull();
    expect(resolveRouteEntitlementKey("/unknown-module")).toBeNull();
  });

  it("resolves dynamic athlete management profile path", () => {
    expect(resolveRouteEntitlementKey(`${PATHS.sporcu}/${ATHLETE_ID}`)).toBe(ENTITLEMENT_KEYS.core);
  });

  it("resolves dynamic private lesson package detail path", () => {
    expect(resolveRouteEntitlementKey(`${PATHS.ozelDersPaketleri}/${PACKAGE_ID}`)).toBe(
      ENTITLEMENT_KEYS.privateLessons
    );
  });

  it("keeps athlete home path separate from management profile", () => {
    expect(resolveRouteEntitlementKey(PATHS.sporcu)).toBe(ENTITLEMENT_KEYS.insightDevelopmentHub);
  });
});
