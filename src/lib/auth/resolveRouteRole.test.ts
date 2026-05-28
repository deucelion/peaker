import { describe, expect, it } from "vitest";
import { canAccessRoute, getDefaultRouteForRole } from "@/lib/auth/roleMatrix";
import { resolveRouteRole } from "@/lib/auth/resolveRouteRole";
import { safeRedirectPath } from "@/lib/auth/routeRedirect";
import { PATHS } from "@/lib/navigation/routeRegistry";

describe("resolveRouteRole", () => {
  it("prefers JWT super_admin over tenant admin profile", () => {
    expect(
      resolveRouteRole({ profileRole: "admin", sessionRole: "super_admin" })
    ).toBe("super_admin");
  });

  it("uses profile role when claim is not super_admin", () => {
    expect(resolveRouteRole({ profileRole: "admin", sessionRole: "admin" })).toBe("admin");
  });

  it("falls back to session role when profile missing", () => {
    expect(resolveRouteRole({ profileRole: null, sessionRole: "coach" })).toBe("coach");
  });
});

describe("super-admin route access", () => {
  it("allows super_admin on /super-admin", () => {
    expect(canAccessRoute("super_admin", PATHS.superAdmin)).toBe(true);
  });

  it("blocks admin from /super-admin", () => {
    expect(canAccessRoute("admin", PATHS.superAdmin)).toBe(false);
    expect(getDefaultRouteForRole("admin")).toBe(PATHS.home);
  });

  it("blocks athlete from /super-admin", () => {
    expect(canAccessRoute("sporcu", PATHS.superAdmin)).toBe(false);
  });

  it("allows super_admin without org on exclusive routes", () => {
    expect(canAccessRoute("super_admin", PATHS.sistemSaglik)).toBe(true);
  });
});

describe("safeRedirectPath", () => {
  it("prevents redirect to the same path", () => {
    expect(safeRedirectPath("/super-admin", "/super-admin")).toBeNull();
    expect(safeRedirectPath("/", "/")).toBeNull();
  });

  it("allows redirect when paths differ", () => {
    expect(safeRedirectPath("/super-admin", "/")).toBe("/");
  });
});
