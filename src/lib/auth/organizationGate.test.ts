import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseAdminClient: vi.fn(() => {
    throw new Error("createSupabaseAdminClient yalnizca admin-fallback testinde mocklanmalı");
  }),
}));

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { evaluateOrganizationProductAccess } from "@/lib/auth/organizationGate";
import {
  NO_ORGANIZATION_GATE_STATUS,
  ORGANIZATION_ROW_UNAVAILABLE_STATUS,
  SCHEMA_INCOMPLETE_GATE_STATUS,
} from "@/lib/organization/license";

function mockSupabaseQuery(result: { data: unknown; error: { message: string } | null }) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => result),
        })),
      })),
    })),
  } as unknown as SupabaseClient;
}

describe("evaluateOrganizationProductAccess", () => {
  it("allows super_admin without organization_id", async () => {
    const supabase = mockSupabaseQuery({ data: null, error: null });
    const out = await evaluateOrganizationProductAccess(supabase, {
      role: "super_admin",
      organization_id: null,
    });
    expect(out).toEqual({ blocked: false });
  });

  it("blocks non-super tenant when organization_id is missing", async () => {
    const supabase = mockSupabaseQuery({ data: null, error: null });
    const out = await evaluateOrganizationProductAccess(supabase, {
      role: "admin",
      organization_id: null,
    });
    expect(out).toEqual({ blocked: true, status: NO_ORGANIZATION_GATE_STATUS });
  });

  it("blocks on missing lifecycle columns (fail-safe)", async () => {
    const supabase = mockSupabaseQuery({
      data: null,
      error: { message: 'column organizations.status does not exist' },
    });
    const out = await evaluateOrganizationProductAccess(supabase, {
      role: "admin",
      organization_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(out).toEqual({ blocked: true, status: SCHEMA_INCOMPLETE_GATE_STATUS });
  });

  it("blocks suspended organization", async () => {
    const supabase = mockSupabaseQuery({
      data: { status: "suspended", starts_at: null, ends_at: null },
      error: null,
    });
    const out = await evaluateOrganizationProductAccess(supabase, {
      role: "coach",
      organization_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(out).toEqual({ blocked: true, status: "suspended" });
  });

  it("allows tenant when anon org read is empty but service role returns active row", async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValueOnce({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({
              data: { status: "active", starts_at: null, ends_at: null },
              error: null,
            })),
          })),
        })),
      })),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const supabase = mockSupabaseQuery({ data: null, error: null });
    const out = await evaluateOrganizationProductAccess(supabase, {
      role: "admin",
      organization_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(out).toEqual({ blocked: false });
  });

  it("blocks with organization_row_unavailable when anon and admin both miss org row", async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValueOnce({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      })),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const supabase = mockSupabaseQuery({ data: null, error: null });
    const out = await evaluateOrganizationProductAccess(supabase, {
      role: "coach",
      organization_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(out).toEqual({ blocked: true, status: ORGANIZATION_ROW_UNAVAILABLE_STATUS });
  });
});
