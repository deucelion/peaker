import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";
import type { FeatureOverrides, FeaturePresetId } from "@/lib/organization/features/types";

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

vi.mock("@/lib/organization/features/persistence/organizationFeaturesRepository", () => ({
  getOrganizationFeatureConfigurationFromAdminClient: vi.fn(),
  saveOrganizationFeatureConfigurationFromAdminClient: vi.fn(),
}));

import {
  loadOrganizationFeatureEditorSnapshot,
  saveOrganizationFeaturePresetAction,
} from "@/lib/actions/organizationFeatureActions";
import {
  getOrganizationFeatureConfigurationFromAdminClient,
  saveOrganizationFeatureConfigurationFromAdminClient,
} from "@/lib/organization/features/persistence/organizationFeaturesRepository";
import {
  createServerSupabaseClient,
  createSupabaseAdminClient,
} from "@/lib/supabase/server";

const ORG_ID = "11111111-1111-4111-8111-111111111111";

function mockSession(role: string | null = "super_admin") {
  vi.mocked(createServerSupabaseClient).mockResolvedValue({
    auth: {
      getUser: async () => ({
        data: { user: role === null ? null : { id: "user-1" } },
        error: null,
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: role === null ? null : { id: "user-1", role },
            error: null,
          }),
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

function mockCurrentConfiguration(params: {
  featurePreset: FeaturePresetId;
  featureOverrides?: FeatureOverrides;
  featuresRevision?: number;
}) {
  vi.mocked(getOrganizationFeatureConfigurationFromAdminClient).mockResolvedValue({
    ok: true,
    data: {
      features: createClubProfessionalFeatures(),
      featuresRevision: params.featuresRevision ?? 4,
      featurePreset: params.featurePreset,
      featureOverrides: params.featureOverrides ?? {},
    },
  });
}

function mockSuccessfulWrite(preset: FeaturePresetId, overrides: FeatureOverrides, revision: number) {
  vi.mocked(saveOrganizationFeatureConfigurationFromAdminClient).mockResolvedValueOnce({
    ok: true,
    data: {
      features: createClubProfessionalFeatures(),
      featuresRevision: revision,
      featurePreset: preset,
      featureOverrides: overrides,
    },
  });
}

describe("organizationFeatureActions authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    mockCurrentConfiguration({ featurePreset: "club_professional" });
  });

  it("loads the feature snapshot for super_admin", async () => {
    const loaded = await loadOrganizationFeatureEditorSnapshot(ORG_ID);

    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.snapshot.organizationName).toBe("Test Org");
      expect(loaded.snapshot.featurePreset).toBe("club_professional");
      expect(loaded.snapshot.featuresRevision).toBe(4);
    }
  });

  it("rejects coach save attempts before touching the repository", async () => {
    mockSession("coach");

    const result = await saveOrganizationFeaturePresetAction({
      organizationId: ORG_ID,
      expectedRevision: 4,
      preset: "academy_lite",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorKind).toBe("permission");
    }
    expect(saveOrganizationFeatureConfigurationFromAdminClient).not.toHaveBeenCalled();
  });

  it("rejects tenant admin save attempts", async () => {
    mockSession("admin");

    const result = await saveOrganizationFeaturePresetAction({
      organizationId: ORG_ID,
      expectedRevision: 4,
      preset: "academy_lite",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorKind).toBe("permission");
    }
    expect(saveOrganizationFeatureConfigurationFromAdminClient).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated save attempts", async () => {
    mockSession(null);

    const result = await saveOrganizationFeaturePresetAction({
      organizationId: ORG_ID,
      expectedRevision: 4,
      preset: "academy_lite",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorKind).toBe("permission");
    }
    expect(saveOrganizationFeatureConfigurationFromAdminClient).not.toHaveBeenCalled();
  });

  it("rejects athlete save attempts", async () => {
    mockSession("sporcu");

    const result = await saveOrganizationFeaturePresetAction({
      organizationId: ORG_ID,
      expectedRevision: 4,
      preset: "custom",
      overrides: { finance: true },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorKind).toBe("permission");
    }
    expect(saveOrganizationFeatureConfigurationFromAdminClient).not.toHaveBeenCalled();
  });

  it("rejects coach attempts to write custom overrides", async () => {
    mockSession("coach");

    const result = await saveOrganizationFeaturePresetAction({
      organizationId: ORG_ID,
      expectedRevision: 4,
      preset: "custom",
      overrides: { finance: true, audit: true },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorKind).toBe("permission");
    }
    expect(saveOrganizationFeatureConfigurationFromAdminClient).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated snapshot reads", async () => {
    mockSession(null);

    const loaded = await loadOrganizationFeatureEditorSnapshot(ORG_ID);

    expect(loaded.ok).toBe(false);
    if (!loaded.ok) {
      expect(loaded.errorKind).toBe("permission");
    }
  });
});

describe("organizationFeatureActions validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
    mockCurrentConfiguration({ featurePreset: "club_professional" });
  });

  it.each(["academy_lite", "academy_plus", "club_professional", "club_enterprise", "custom"] as const)(
    "accepts the supported preset %s",
    async (preset) => {
      mockSuccessfulWrite(preset, {}, 5);

      const result = await saveOrganizationFeaturePresetAction({
        organizationId: ORG_ID,
        expectedRevision: 4,
        preset,
      });

      expect(result.ok).toBe(true);
    }
  );

  it("rejects an unknown preset before writing", async () => {
    const result = await saveOrganizationFeaturePresetAction({
      organizationId: ORG_ID,
      expectedRevision: 4,
      preset: "enterprise_ultra",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorKind).toBe("validation");
    }
    expect(saveOrganizationFeatureConfigurationFromAdminClient).not.toHaveBeenCalled();
  });

  it("rejects an invalid organization id", async () => {
    const result = await saveOrganizationFeaturePresetAction({
      organizationId: "not-a-uuid",
      expectedRevision: 4,
      preset: "academy_lite",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorKind).toBe("validation");
    }
    expect(saveOrganizationFeatureConfigurationFromAdminClient).not.toHaveBeenCalled();
  });

  it("rejects a negative expected revision", async () => {
    const result = await saveOrganizationFeaturePresetAction({
      organizationId: ORG_ID,
      expectedRevision: -1,
      preset: "academy_lite",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorKind).toBe("validation");
    }
    expect(saveOrganizationFeatureConfigurationFromAdminClient).not.toHaveBeenCalled();
  });
});

describe("organizationFeatureActions save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("assigns a named preset and returns the incremented revision", async () => {
    mockCurrentConfiguration({ featurePreset: "club_professional", featuresRevision: 4 });
    mockSuccessfulWrite("academy_lite", {}, 5);

    const result = await saveOrganizationFeaturePresetAction({
      organizationId: ORG_ID,
      expectedRevision: 4,
      preset: "academy_lite",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.featurePreset).toBe("academy_lite");
      expect(result.featuresRevision).toBe(5);
    }
    expect(saveOrganizationFeatureConfigurationFromAdminClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organizationId: ORG_ID,
        preset: "academy_lite",
        expectedRevision: 4,
      })
    );
  });

  it("forwards the loaded revision so a stale write cannot overwrite newer data", async () => {
    mockCurrentConfiguration({ featurePreset: "club_professional", featuresRevision: 6 });
    vi.mocked(saveOrganizationFeatureConfigurationFromAdminClient).mockResolvedValueOnce({
      ok: false,
      code: "revision_conflict",
      message: "features_revision beklenen 5, mevcut 6.",
    });

    const result = await saveOrganizationFeaturePresetAction({
      organizationId: ORG_ID,
      expectedRevision: 5,
      preset: "academy_lite",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorKind).toBe("revision_conflict");
    }
    expect(saveOrganizationFeatureConfigurationFromAdminClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ expectedRevision: 5 })
    );
  });

  it("maps a missing organization to not_found", async () => {
    vi.mocked(getOrganizationFeatureConfigurationFromAdminClient).mockResolvedValue({
      ok: false,
      code: "not_found",
      message: "Organizasyon bulunamadi.",
    });

    const result = await saveOrganizationFeaturePresetAction({
      organizationId: ORG_ID,
      expectedRevision: 4,
      preset: "academy_lite",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorKind).toBe("not_found");
    }
    expect(saveOrganizationFeatureConfigurationFromAdminClient).not.toHaveBeenCalled();
  });
});

describe("organizationFeatureActions override semantics", () => {
  const existingOverrides: FeatureOverrides = {
    finance: true,
    "insight.field_tests": false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("preserves existing overrides when custom stays selected", async () => {
    mockCurrentConfiguration({ featurePreset: "custom", featureOverrides: existingOverrides });
    mockSuccessfulWrite("custom", existingOverrides, 5);

    const result = await saveOrganizationFeaturePresetAction({
      organizationId: ORG_ID,
      expectedRevision: 4,
      preset: "custom",
    });

    expect(result.ok).toBe(true);
    expect(saveOrganizationFeatureConfigurationFromAdminClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        preset: "custom",
        overrides: existingOverrides,
      })
    );
  });

  it("clears overrides when a named preset is assigned so the template applies verbatim", async () => {
    mockCurrentConfiguration({ featurePreset: "custom", featureOverrides: existingOverrides });
    mockSuccessfulWrite("club_professional", {}, 5);

    const result = await saveOrganizationFeaturePresetAction({
      organizationId: ORG_ID,
      expectedRevision: 4,
      preset: "club_professional",
    });

    expect(result.ok).toBe(true);
    expect(saveOrganizationFeatureConfigurationFromAdminClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        preset: "club_professional",
        overrides: {},
      })
    );
  });

  it("ignores client supplied overrides when a named preset is assigned", async () => {
    mockCurrentConfiguration({ featurePreset: "custom", featureOverrides: existingOverrides });
    mockSuccessfulWrite("academy_lite", {}, 5);

    const result = await saveOrganizationFeaturePresetAction({
      organizationId: ORG_ID,
      expectedRevision: 4,
      preset: "academy_lite",
      overrides: { finance: true, audit: true },
    });

    expect(result.ok).toBe(true);
    expect(saveOrganizationFeatureConfigurationFromAdminClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ preset: "academy_lite", overrides: {} })
    );
  });
});

describe("organizationFeatureActions custom overrides", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("persists overrides supplied by the editor", async () => {
    const desired = { finance: true, audit: false, "insight.field_tests": true };
    mockCurrentConfiguration({ featurePreset: "club_professional" });
    mockSuccessfulWrite("custom", desired, 5);

    const result = await saveOrganizationFeaturePresetAction({
      organizationId: ORG_ID,
      expectedRevision: 4,
      preset: "custom",
      overrides: desired,
    });

    expect(result.ok).toBe(true);
    expect(saveOrganizationFeatureConfigurationFromAdminClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ preset: "custom", overrides: desired })
    );
  });

  it("accepts an explicitly empty override map", async () => {
    mockCurrentConfiguration({ featurePreset: "custom", featureOverrides: { finance: true } });
    mockSuccessfulWrite("custom", {}, 5);

    const result = await saveOrganizationFeaturePresetAction({
      organizationId: ORG_ID,
      expectedRevision: 4,
      preset: "custom",
      overrides: {},
    });

    expect(result.ok).toBe(true);
    expect(saveOrganizationFeatureConfigurationFromAdminClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ preset: "custom", overrides: {} })
    );
  });

  it("preserves stored overrides when the caller omits them entirely", async () => {
    const stored = { finance: true };
    mockCurrentConfiguration({ featurePreset: "custom", featureOverrides: stored });
    mockSuccessfulWrite("custom", stored, 5);

    const result = await saveOrganizationFeaturePresetAction({
      organizationId: ORG_ID,
      expectedRevision: 4,
      preset: "custom",
    });

    expect(result.ok).toBe(true);
    expect(saveOrganizationFeatureConfigurationFromAdminClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ overrides: stored })
    );
  });

  it("accepts the insight bundle parent as an override key", async () => {
    mockCurrentConfiguration({ featurePreset: "custom" });
    mockSuccessfulWrite("custom", { insight: true }, 5);

    const result = await saveOrganizationFeaturePresetAction({
      organizationId: ORG_ID,
      expectedRevision: 4,
      preset: "custom",
      overrides: { insight: true },
    });

    expect(result.ok).toBe(true);
  });

  it("rejects an unknown entitlement key before writing", async () => {
    mockCurrentConfiguration({ featurePreset: "custom" });

    const result = await saveOrganizationFeaturePresetAction({
      organizationId: ORG_ID,
      expectedRevision: 4,
      preset: "custom",
      overrides: { finance: true, unknown_module: true },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorKind).toBe("validation");
    }
    expect(saveOrganizationFeatureConfigurationFromAdminClient).not.toHaveBeenCalled();
  });

  it("cannot switch an always-on entitlement off", async () => {
    mockCurrentConfiguration({ featurePreset: "custom" });
    mockSuccessfulWrite("custom", { core: false }, 5);

    const result = await saveOrganizationFeaturePresetAction({
      organizationId: ORG_ID,
      expectedRevision: 4,
      preset: "custom",
      overrides: { core: false },
    });

    // `core` is canonical so it passes key validation, but recompute forces it back on.
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.features.core).toBe(true);
      expect(result.features.athlete).toBe(true);
    }
  });

  it("rejects a non-boolean override value", async () => {
    mockCurrentConfiguration({ featurePreset: "custom" });

    const result = await saveOrganizationFeaturePresetAction({
      organizationId: ORG_ID,
      expectedRevision: 4,
      preset: "custom",
      overrides: { finance: "evet" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorKind).toBe("validation");
    }
    expect(saveOrganizationFeatureConfigurationFromAdminClient).not.toHaveBeenCalled();
  });

  it("rejects a non-object override payload", async () => {
    mockCurrentConfiguration({ featurePreset: "custom" });

    const result = await saveOrganizationFeaturePresetAction({
      organizationId: ORG_ID,
      expectedRevision: 4,
      preset: "custom",
      overrides: ["finance"] as unknown as Record<string, unknown>,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorKind).toBe("validation");
    }
    expect(saveOrganizationFeatureConfigurationFromAdminClient).not.toHaveBeenCalled();
  });

  it("still enforces optimistic concurrency for custom override writes", async () => {
    mockCurrentConfiguration({ featurePreset: "custom", featuresRevision: 9 });
    vi.mocked(saveOrganizationFeatureConfigurationFromAdminClient).mockResolvedValueOnce({
      ok: false,
      code: "revision_conflict",
      message: "features_revision beklenen 8, mevcut 9.",
    });

    const result = await saveOrganizationFeaturePresetAction({
      organizationId: ORG_ID,
      expectedRevision: 8,
      preset: "custom",
      overrides: { finance: true },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorKind).toBe("revision_conflict");
    }
    expect(saveOrganizationFeatureConfigurationFromAdminClient).toHaveBeenCalledTimes(1);
  });
});
