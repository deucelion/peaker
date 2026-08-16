import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";
import { buildOrganizationFeaturesFromConfigurable } from "@/lib/organization/features/helpers";
import { CONFIGURABLE_ENTITLEMENT_KEYS } from "@/lib/organization/features/keys";
import { runServerActionWithFeatureGate } from "@/lib/auth/serverActionFeatureGate";

vi.mock("@/lib/organization/features/runtime/getOrganizationFeatures", () => ({
  getOrganizationFeatures: vi.fn(),
}));

vi.mock("@/lib/auth/resolveSessionActor", () => ({
  resolveSessionActor: vi.fn(),
}));

import { getOrganizationFeatures } from "@/lib/organization/features/runtime/getOrganizationFeatures";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";

const DENIAL = {
  error: "Bu modul organizasyonunuz icin aktif degil.",
  errorKind: "permission_denied",
} as const;

/** Fail-closed runtime ciktisi: core/athlete acik, configurable kapali. */
function failClosedFeatures() {
  return buildOrganizationFeaturesFromConfigurable(
    Object.fromEntries(CONFIGURABLE_ENTITLEMENT_KEYS.map((key) => [key, false])) as Record<
      (typeof CONFIGURABLE_ENTITLEMENT_KEYS)[number],
      boolean
    >
  );
}

function mockActor(overrides: Partial<{ role: string; organizationId: string | null }> = {}) {
  vi.mocked(resolveSessionActor).mockResolvedValue({
    actor: {
      id: "user-1",
      role: (overrides.role ?? "admin") as "admin",
      organizationId: overrides.organizationId === undefined ? "org-a" : overrides.organizationId,
      isActive: true,
      fullName: "Actor",
    },
  });
}

function mockFeatures(features: ReturnType<typeof failClosedFeatures>, source = "database") {
  vi.mocked(getOrganizationFeatures).mockResolvedValue({
    features,
    featuresRevision: 1,
    source: source as "database",
  });
}

describe("FAZ 41 — pre-execution entitlement gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActor();
  });

  it("1. entitlement ON → action body runs", async () => {
    mockFeatures(createClubProfessionalFeatures());
    const body = vi.fn(async () => ({ ok: true }));

    const result = await runServerActionWithFeatureGate("finance.listOrgPaymentsForAdmin", body);

    expect(result).toEqual({ ok: true });
    expect(body).toHaveBeenCalledTimes(1);
  });

  it("2. entitlement OFF → action body never runs", async () => {
    mockFeatures(failClosedFeatures());
    const body = vi.fn(async () => ({ ok: true }));

    await runServerActionWithFeatureGate("finance.listOrgPaymentsForAdmin", body);

    expect(body).not.toHaveBeenCalled();
  });

  it("3. entitlement OFF → permission denial is returned", async () => {
    mockFeatures(failClosedFeatures());

    const result = await runServerActionWithFeatureGate(
      "privateLesson.createPrivateLessonPackage",
      async () => ({ ok: true })
    );

    expect(result).toEqual(DENIAL);
  });

  it("4. missing organization id → resolves against blank org and body never runs", async () => {
    mockActor({ organizationId: null });
    mockFeatures(failClosedFeatures(), "repository_error_fallback");
    const body = vi.fn(async () => ({ ok: true }));

    const result = await runServerActionWithFeatureGate("fieldTest.saveFieldTestResult", body);

    expect(getOrganizationFeatures).toHaveBeenCalledWith("");
    expect(body).not.toHaveBeenCalled();
    expect(result).toEqual(DENIAL);
  });

  it("5. invalid/unknown organization id → body never runs", async () => {
    mockActor({ organizationId: "   " });
    mockFeatures(failClosedFeatures(), "repository_error_fallback");
    const body = vi.fn(async () => ({ ok: true }));

    await runServerActionWithFeatureGate("wellness.listWellnessReports", body);

    expect(body).not.toHaveBeenCalled();
  });

  it("6. feature repository error → body never runs", async () => {
    mockFeatures(failClosedFeatures(), "repository_error_fallback");
    const body = vi.fn(async () => ({ ok: true }));

    const result = await runServerActionWithFeatureGate("audit.exportAuditLogsCSV", body);

    expect(body).not.toHaveBeenCalled();
    expect(result).toEqual(DENIAL);
  });

  it("7. feature parsing error → body never runs", async () => {
    // Parser malformed payload icin fail-closed map dondurur.
    mockFeatures(failClosedFeatures());
    const body = vi.fn(async () => ({ ok: true }));

    await runServerActionWithFeatureGate("performance.loadPerformanceAnalytics", body);

    expect(body).not.toHaveBeenCalled();
  });

  it("8. always-on `core` stays allowed even when the feature map is fail-closed", async () => {
    mockFeatures(failClosedFeatures());
    const body = vi.fn(async () => ({ ok: true }));

    const result = await runServerActionWithFeatureGate("team.listTeams", body);

    expect(result).toEqual({ ok: true });
    expect(body).toHaveBeenCalledTimes(1);
    expect(getOrganizationFeatures).not.toHaveBeenCalled();
  });

  it("9. always-on `athlete` stays allowed even when the feature map is fail-closed", async () => {
    mockFeatures(failClosedFeatures());
    const body = vi.fn(async () => ({ ok: true }));

    const result = await runServerActionWithFeatureGate("trainingLoadSurvey.submitSurvey", body);

    expect(result).toEqual({ ok: true });
    expect(body).toHaveBeenCalledTimes(1);
    expect(getOrganizationFeatures).not.toHaveBeenCalled();
  });

  it("unmapped namespaces are never gated", async () => {
    const body = vi.fn(async () => ({ ok: true }));

    await runServerActionWithFeatureGate("organizationFeature.saveConfiguration", body);

    expect(body).toHaveBeenCalledTimes(1);
    expect(getOrganizationFeatures).not.toHaveBeenCalled();
  });
});

describe("FAZ 41 — mutation protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActor();
  });

  it("feature OFF → representative mutation action performs no database write", async () => {
    mockFeatures(failClosedFeatures());
    const dbWrite = vi.fn(async () => ({ data: { id: "payment-1" }, error: null }));

    const result = await runServerActionWithFeatureGate("payment.recordOrgPayment", async () => {
      await dbWrite();
      return { ok: true };
    });

    expect(dbWrite).not.toHaveBeenCalled();
    expect(result).toEqual(DENIAL);
  });

  it("feature ON → the same mutation reaches the database", async () => {
    mockFeatures(createClubProfessionalFeatures());
    const dbWrite = vi.fn(async () => ({ data: { id: "payment-1" }, error: null }));

    await runServerActionWithFeatureGate("payment.recordOrgPayment", async () => {
      await dbWrite();
      return { ok: true };
    });

    expect(dbWrite).toHaveBeenCalledTimes(1);
  });
});

describe("FAZ 41 — post-lookup actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActor();
  });

  it("entitlement check sits between the entity lookup and the mutation", async () => {
    mockFeatures(failClosedFeatures());
    const lookup = vi.fn(async () => ({ organization_id: "org-a" }));
    const mutate = vi.fn(async () => ({ error: null }));

    // Pre-check zaten deny ettigi icin body hic calismaz; body yine de
    // dogru sirayi (lookup → assert → mutation) uygular.
    const result = await runServerActionWithFeatureGate("wellness.updateWellnessReport", async (ctx) => {
      const row = await lookup();
      const denial = await ctx.assertOrganizationFeature(row.organization_id);
      if (denial) return denial;
      await mutate();
      return { ok: true };
    });

    expect(mutate).not.toHaveBeenCalled();
    expect(result).toEqual(DENIAL);
  });

  it("explicit assert still blocks the mutation when the row belongs to a disabled org", async () => {
    // Pre-check ALLOW (session org acik), lookup edilen satirin org'u kapali.
    vi.mocked(getOrganizationFeatures).mockImplementation(async (organizationId: string) => ({
      features: organizationId === "org-a" ? createClubProfessionalFeatures() : failClosedFeatures(),
      featuresRevision: 1,
      source: "database" as const,
    }));

    const mutate = vi.fn(async () => ({ error: null }));

    const result = await runServerActionWithFeatureGate("wellness.updateWellnessReport", async (ctx) => {
      const denial = await ctx.assertOrganizationFeature("org-b");
      if (denial) return denial;
      await mutate();
      return { ok: true };
    });

    expect(mutate).not.toHaveBeenCalled();
    expect(result).toEqual(DENIAL);
  });
});

describe("FAZ 41 — actor scoping and tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gates strictly on the session organization, never on a requested foreign org", async () => {
    // Kullanici Organization A'ya ait; A'da finance kapali.
    mockActor({ organizationId: "org-a" });
    vi.mocked(getOrganizationFeatures).mockImplementation(async (organizationId: string) => ({
      features: organizationId === "org-b" ? createClubProfessionalFeatures() : failClosedFeatures(),
      featuresRevision: 1,
      source: "database" as const,
    }));

    const body = vi.fn(async () => ({ ok: true }));
    const result = await runServerActionWithFeatureGate("finance.listOrgPaymentsForAdmin", body);

    // Organization B'nin acik entitlement'i A kullanicisina erisim saglamamali.
    expect(getOrganizationFeatures).toHaveBeenCalledWith("org-a");
    expect(getOrganizationFeatures).not.toHaveBeenCalledWith("org-b");
    expect(body).not.toHaveBeenCalled();
    expect(result).toEqual(DENIAL);
  });

  it("skips the org gate for super_admin, whose target org arrives as an action argument", async () => {
    mockActor({ role: "super_admin", organizationId: null });
    const body = vi.fn(async () => ({ ok: true }));

    const result = await runServerActionWithFeatureGate("audit.listAuditLogsForActor", body);

    expect(result).toEqual({ ok: true });
    expect(body).toHaveBeenCalledTimes(1);
    expect(getOrganizationFeatures).not.toHaveBeenCalled();
  });

  it("skips the org gate when there is no session so the action returns its own auth error", async () => {
    vi.mocked(resolveSessionActor).mockResolvedValue({ error: "Gecersiz oturum." });
    const body = vi.fn(async () => ({ error: "Gecersiz oturum.", errorKind: "permission_denied" as const }));

    const result = await runServerActionWithFeatureGate("finance.listOrgPaymentsForAdmin", body);

    expect(result).toEqual({ error: "Gecersiz oturum.", errorKind: "permission_denied" });
    expect(getOrganizationFeatures).not.toHaveBeenCalled();
  });
});
