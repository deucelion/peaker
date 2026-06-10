import { describe, expect, it } from "vitest";
import { assertAdminCanSetUserPassword } from "./adminPasswordPolicy";

const orgId = "11111111-1111-4111-8111-111111111111";
const otherOrg = "22222222-2222-4222-8222-222222222222";

describe("assertAdminCanSetUserPassword", () => {
  it("blocks self reset", () => {
    const msg = assertAdminCanSetUserPassword(
      { kind: "admin", actorId: "a", actorRole: "admin", organizationId: orgId },
      { id: "a", role: "admin", organization_id: orgId }
    );
    expect(msg).toMatch(/Kendi sifrenizi/);
  });

  it("org admin can reset coach and athlete in same org", () => {
    const actor = { kind: "admin" as const, actorId: "admin-1", actorRole: "admin", organizationId: orgId };
    expect(assertAdminCanSetUserPassword(actor, { id: "c", role: "coach", organization_id: orgId })).toBeNull();
    expect(assertAdminCanSetUserPassword(actor, { id: "s", role: "sporcu", organization_id: orgId })).toBeNull();
  });

  it("org admin cannot reset other org or org admin", () => {
    const actor = { kind: "admin" as const, actorId: "admin-1", actorRole: "admin", organizationId: orgId };
    expect(assertAdminCanSetUserPassword(actor, { id: "x", role: "coach", organization_id: otherOrg })).toMatch(/ait degil/);
    expect(assertAdminCanSetUserPassword(actor, { id: "x", role: "admin", organization_id: orgId })).toMatch(/yalnizca koc/);
  });

  it("super admin can reset any org user", () => {
    const actor = { kind: "super_admin" as const, actorId: "sa", actorRole: "super_admin" };
    expect(assertAdminCanSetUserPassword(actor, { id: "a", role: "admin", organization_id: orgId })).toBeNull();
    expect(assertAdminCanSetUserPassword(actor, { id: "c", role: "coach", organization_id: otherOrg })).toBeNull();
  });
});
