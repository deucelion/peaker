import { describe, expect, it } from "vitest";
import { canAccessRoute, getDefaultRouteForRole } from "@/lib/auth/roleMatrix";
import { resolveRouteRole } from "@/lib/auth/resolveRouteRole";
import { safeRedirectPath } from "@/lib/auth/routeRedirect";
import { denyAllCoachPermissions, isRouteBlockedForCoach } from "@/lib/auth/coachPermissions";
import { denyAllAthletePermissions } from "@/lib/auth/athletePermissions";
import { PATHS } from "@/lib/navigation/routeRegistry";

describe("resolveRouteRole", () => {
  it("FAZ 29: JWT super_admin claim'i yetki yukseltemez — profil rolu kazanir", () => {
    expect(
      resolveRouteRole({ profileRole: "admin", sessionRole: "super_admin" })
    ).toBe("admin");
  });

  it("FAZ 29: profil yokken super_admin claim'i null doner", () => {
    expect(resolveRouteRole({ profileRole: null, sessionRole: "super_admin" })).toBeNull();
    expect(resolveRouteRole({ profileRole: null, sessionRole: "Super Admin" })).toBeNull();
    expect(resolveRouteRole({ profileRole: "", sessionRole: "superadmin" })).toBeNull();
  });

  it("prefers profile super_admin over tenant admin JWT claim", () => {
    expect(
      resolveRouteRole({ profileRole: "super_admin", sessionRole: "admin" })
    ).toBe("super_admin");
  });

  it("recognizes messy super admin role strings in profile", () => {
    expect(resolveRouteRole({ profileRole: "Super Admin", sessionRole: null })).toBe("super_admin");
  });

  it("uses profile role when claim is not super_admin", () => {
    expect(resolveRouteRole({ profileRole: "admin", sessionRole: "admin" })).toBe("admin");
  });

  it("falls back to session role when profile missing (tenant rolleri)", () => {
    expect(resolveRouteRole({ profileRole: null, sessionRole: "coach" })).toBe("coach");
    expect(resolveRouteRole({ profileRole: null, sessionRole: "sporcu" })).toBe("sporcu");
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

describe("FAZ 29: fail-closed izin setleri", () => {
  it("denyAllCoachPermissions tum izinleri kapatir", () => {
    const perms = denyAllCoachPermissions();
    expect(Object.values(perms).every((v) => v === false)).toBe(true);
  });

  it("denyAllAthletePermissions tum izinleri kapatir", () => {
    const perms = denyAllAthletePermissions();
    expect(Object.values(perms).every((v) => v === false)).toBe(true);
  });

  it("deny-all set ile rapor rotasi koca kapali, serbest rota acik kalir", () => {
    const perms = denyAllCoachPermissions();
    expect(isRouteBlockedForCoach(PATHS.performans, perms)).toBe(true);
    expect(isRouteBlockedForCoach("/", perms)).toBe(false);
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

  it("prevents org-durumu self redirect loop", () => {
    expect(safeRedirectPath("/org-durumu", "/org-durumu")).toBeNull();
  });
});
