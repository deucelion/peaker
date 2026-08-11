import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/observability/serverActionError", () => ({
  withServerActionGuard: vi.fn((_name: string, fn: () => Promise<unknown>) => fn()),
  captureServerActionError: vi.fn(),
}));

vi.mock("@/lib/organization/branding/persistence/organizationBrandingRepository", () => ({
  getOrganizationBrandingFromAdminClient: vi.fn(),
  saveOrganizationBrandingFromAdminClient: vi.fn(),
}));

import {
  loadOrganizationBrandingEditorSnapshot,
  saveOrganizationBrandingAction,
} from "@/lib/actions/organizationBrandingActions";
import {
  getOrganizationBrandingFromAdminClient,
  saveOrganizationBrandingFromAdminClient,
} from "@/lib/organization/branding/persistence/organizationBrandingRepository";
import {
  createServerSupabaseClient,
  createSupabaseAdminClient,
} from "@/lib/supabase/server";

const ORG_ID = "11111111-1111-4111-8111-111111111111";

function mockSuperAdminSession(role: string = "super_admin") {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { id: "user-1", role }, error: null }),
        }),
      }),
    }),
  } as never);

  vi.mocked(createSupabaseAdminClient).mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { name: "Test Org" }, error: null }),
        }),
      }),
    }),
  } as never);
}

describe("organizationBrandingActions authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSuperAdminSession();
    vi.mocked(getOrganizationBrandingFromAdminClient).mockResolvedValue({
      ok: true,
      data: {
        branding: createDefaultBranding(),
        brandingRevision: 2,
      },
    });
  });

  it("rejects non-super-admin save attempts", async () => {
    mockSuperAdminSession("coach");

    const result = await saveOrganizationBrandingAction({
      organizationId: ORG_ID,
      expectedRevision: 2,
      theme: { primary: "#112233" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorKind).toBe("permission");
    }
    expect(saveOrganizationBrandingFromAdminClient).not.toHaveBeenCalled();
  });

  it("loads branding snapshot for super_admin", async () => {
    const loaded = await loadOrganizationBrandingEditorSnapshot(ORG_ID);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.snapshot.organizationName).toBe("Test Org");
      expect(loaded.snapshot.brandingRevision).toBe(2);
    }
  });
});

describe("organizationBrandingActions save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSuperAdminSession();

    vi.mocked(getOrganizationBrandingFromAdminClient).mockResolvedValue({
      ok: true,
      data: {
        branding: createDefaultBranding(),
        brandingRevision: 2,
      },
    });
  });

  it("saves valid theme updates and increments revision", async () => {
    vi.mocked(saveOrganizationBrandingFromAdminClient).mockResolvedValueOnce({
      ok: true,
      data: {
        branding: {
          ...createDefaultBranding(),
          theme: {
            ...createDefaultBranding().theme,
            primary: "#112233",
          },
          brandingRevision: 3,
        },
        brandingRevision: 3,
      },
    });

    const result = await saveOrganizationBrandingAction({
      organizationId: ORG_ID,
      expectedRevision: 2,
      theme: { primary: "#112233" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.brandingRevision).toBe(3);
    }
    expect(saveOrganizationBrandingFromAdminClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organizationId: ORG_ID,
        expectedRevision: 2,
      })
    );
  });

  it("rejects invalid colors before write", async () => {
    const result = await saveOrganizationBrandingAction({
      organizationId: ORG_ID,
      expectedRevision: 2,
      theme: { primary: "bad-color" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorKind).toBe("validation");
      expect(result.fieldErrors?.primary).toBeTruthy();
    }
    expect(saveOrganizationBrandingFromAdminClient).not.toHaveBeenCalled();
  });

  it("returns revision_conflict without overwriting", async () => {
    vi.mocked(saveOrganizationBrandingFromAdminClient).mockResolvedValueOnce({
      ok: false,
      code: "revision_conflict",
      message: "revision conflict",
    });

    const result = await saveOrganizationBrandingAction({
      organizationId: ORG_ID,
      expectedRevision: 1,
      theme: { primary: "#112233" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorKind).toBe("revision_conflict");
    }
  });
});
