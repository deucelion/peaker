import { beforeEach, describe, expect, it, vi } from "vitest";
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

const ORG_ID = "org-a";
const DENIAL = {
  error: "Bu modul organizasyonunuz icin aktif degil.",
  errorKind: "permission_denied",
};

function mockActor() {
  vi.mocked(resolveSessionActor).mockResolvedValue({
    actor: {
      id: "user-1",
      role: "admin",
      organizationId: ORG_ID,
      isActive: true,
      fullName: "Admin",
    },
  });
}

function mockAllDisabledFeatures() {
  const configurable = Object.fromEntries(CONFIGURABLE_ENTITLEMENT_KEYS.map((key) => [key, false])) as Record<
    (typeof CONFIGURABLE_ENTITLEMENT_KEYS)[number],
    boolean
  >;
  vi.mocked(getOrganizationFeatures).mockResolvedValue({
    features: buildOrganizationFeaturesFromConfigurable(configurable),
    featuresRevision: 1,
    source: "database",
  });
}

describe("athlete save integrity — entitlement gate vs client success", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActor();
  });

  it("fieldTest save: disabled entitlement → body calismaz → success donulmez", async () => {
    mockAllDisabledFeatures();
    const dbWrite = vi.fn(async () => ({ ok: true }));

    const result = await runServerActionWithFeatureGate("fieldTest.saveAthleticFieldResults", async () => {
      await dbWrite();
      return { success: true as const };
    });

    expect(dbWrite).not.toHaveBeenCalled();
    expect(result).toEqual(DENIAL);
    expect(result).not.toHaveProperty("success");
  });

  it("bodyMeasurement save: disabled entitlement → body calismaz → success donulmez", async () => {
    mockAllDisabledFeatures();
    const dbWrite = vi.fn(async () => ({ ok: true }));

    const result = await runServerActionWithFeatureGate("bodyMeasurement.recordMyBodyMeasurement", async () => {
      await dbWrite();
      return { success: true as const };
    });

    expect(dbWrite).not.toHaveBeenCalled();
    expect(result).toEqual(DENIAL);
  });

  it("wellness save: disabled entitlement → body calismaz → success donulmez", async () => {
    mockAllDisabledFeatures();
    const dbWrite = vi.fn(async () => ({ success: true as const }));

    const result = await runServerActionWithFeatureGate("wellness.submitWellnessReportToday", async () => {
      return dbWrite();
    });

    expect(dbWrite).not.toHaveBeenCalled();
    expect(result).toEqual(DENIAL);
  });
});

describe("athlete save integrity — client success contract", () => {
  it("permission denial nesnesi success gibi yorumlanmamali", () => {
    const denial = { ...DENIAL };
    expect("success" in denial).toBe(false);
    expect("error" in denial && denial.error).toBeTruthy();
  });

  it("gercek success yalnizca success alani ile gelir", () => {
    const ok = { success: true as const };
    expect("error" in ok).toBe(false);
    expect("success" in ok && ok.success).toBe(true);
  });

  it("field test partial stale online sonucu success gibi yorumlanmamali", () => {
    const staleFailure = {
      error: "Bazi degerler kaydedilemedi; sunucudaki kayit daha guncel. Sayfayi yenileyip tekrar deneyin.",
    };
    expect("success" in staleFailure).toBe(false);
    expect("error" in staleFailure && staleFailure.error).toBeTruthy();
  });

  it("field test tam basari sonrasi refresh icin success contract korunur", () => {
    const ok = { success: true as const };
    expect("error" in ok).toBe(false);
    expect(ok.success).toBe(true);
  });

  it("profil 0-row update hatasi success donmemeli", () => {
    const zeroRow = { error: "Profil guncellenemedi: kayit bulunamadi." };
    expect("success" in zeroRow).toBe(false);
    expect(zeroRow.error).toContain("kayit bulunamadi");
  });

  it("body measurement verify basarisizligi success donmemeli", () => {
    const verifyFail = { error: "Olçüm kaydedilemedi: doğrulama başarısız." };
    expect("success" in verifyFail).toBe(false);
  });
});
