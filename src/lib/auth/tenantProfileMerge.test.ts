import { describe, expect, it } from "vitest";
import { mergeTenantProfileFromSources } from "./tenantProfileMerge";

describe("mergeTenantProfileFromSources", () => {
  it("prefers DB role and does not fill organization_id from JWT", () => {
    const merged = mergeTenantProfileFromSources({
      profile: {
        role: "coach",
        full_name: "A",
        organization_id: "11111111-1111-4111-8111-111111111111",
        is_active: true,
      },
      metaRole: "sporcu",
      metaFullName: "Meta",
      metaOrgId: "22222222-2222-4222-8222-222222222222",
    });
    expect(merged).toEqual({
      role: "coach",
      full_name: "A",
      organization_id: "11111111-1111-4111-8111-111111111111",
      is_active: true,
    });
  });

  it("uses metadata role when DB role empty but keeps organization_id DB-only", () => {
    const merged = mergeTenantProfileFromSources({
      profile: {
        role: "",
        full_name: null,
        organization_id: null,
        is_active: null,
      },
      metaRole: "coach",
      metaFullName: null,
      metaOrgId: "33333333-3333-4333-8333-333333333333",
    });
    expect(merged).toEqual({
      role: "coach",
      full_name: null,
      organization_id: null,
      is_active: true,
    });
  });

  it("returns null when no role in DB or metadata", () => {
    expect(
      mergeTenantProfileFromSources({
        profile: { role: null, full_name: null, organization_id: null, is_active: null },
        metaRole: null,
        metaFullName: null,
        metaOrgId: "33333333-3333-4333-8333-333333333333",
      })
    ).toBeNull();
  });
});
