import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";
import { buildOrganizationFeaturesFromConfigurable } from "@/lib/organization/features/helpers";
import { CONFIGURABLE_ENTITLEMENT_KEYS } from "@/lib/organization/features/keys";
import { EXPORT_ENDPOINT_IDS } from "@/lib/organization/features/surfaces/exportEntitlementMap";
import {
  assertExportFeatureForOrg,
  evaluateExportFeatureAccess,
  evaluateExportFeatureAccessAfterPermissions,
} from "@/lib/auth/exportFeatureAccess";
import { shouldRenderExportUi } from "@/lib/navigation/exportFeatureVisibility";

vi.mock("@/lib/organization/features/runtime/getOrganizationFeatures", () => ({
  getOrganizationFeatures: vi.fn(),
}));

import { getOrganizationFeatures } from "@/lib/organization/features/runtime/getOrganizationFeatures";

function createAllDisabledFeatures() {
  const configurable = Object.fromEntries(CONFIGURABLE_ENTITLEMENT_KEYS.map((key) => [key, false])) as Record<
    (typeof CONFIGURABLE_ENTITLEMENT_KEYS)[number],
    boolean
  >;
  return buildOrganizationFeaturesFromConfigurable(configurable);
}

describe("exportFeatureAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows mapped exports when entitlement is enabled", async () => {
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createClubProfessionalFeatures(),
      featuresRevision: 1,
      source: "database",
    });

    const decision = await assertExportFeatureForOrg(EXPORT_ENDPOINT_IDS.paymentsStream, "org-1");
    expect(decision).toBeNull();
    expect(getOrganizationFeatures).toHaveBeenCalledWith("org-1");
    expect(evaluateExportFeatureAccess(EXPORT_ENDPOINT_IDS.auditLogsCsv, createClubProfessionalFeatures())).toBe(
      "allow"
    );
  });

  it("denies mapped exports when entitlement is disabled", async () => {
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createAllDisabledFeatures(),
      featuresRevision: 2,
      source: "database",
    });

    const denial = await assertExportFeatureForOrg(EXPORT_ENDPOINT_IDS.receivablesStream, "org-1");
    expect(denial).toEqual({
      error: "Bu modul organizasyonunuz icin aktif degil.",
      errorKind: "permission_denied",
    });
    expect(evaluateExportFeatureAccess(EXPORT_ENDPOINT_IDS.performanceSummaryCsv, createAllDisabledFeatures())).toBe(
      "deny"
    );
  });

  it("does not call runtime when permission phase failed", async () => {
    const decision = await evaluateExportFeatureAccessAfterPermissions(
      EXPORT_ENDPOINT_IDS.auditLogStream,
      "org-1",
      true
    );
    expect(decision).toBe("skip");
    expect(getOrganizationFeatures).not.toHaveBeenCalled();
  });

  it("hides export UI when role phase failed", () => {
    expect(
      shouldRenderExportUi(EXPORT_ENDPOINT_IDS.paymentsStream, {
        roleAllowed: false,
        permissionAllowed: true,
        organizationFeatures: createAllDisabledFeatures(),
      })
    ).toBe(false);
    expect(getOrganizationFeatures).not.toHaveBeenCalled();
  });

  it("hides export UI when permission phase failed", () => {
    expect(
      shouldRenderExportUi(EXPORT_ENDPOINT_IDS.fieldTestResultsCsv, {
        roleAllowed: true,
        permissionAllowed: false,
        organizationFeatures: createClubProfessionalFeatures(),
      })
    ).toBe(false);
    expect(getOrganizationFeatures).not.toHaveBeenCalled();
  });

  it("uses Club Professional fallback when kill switch is OFF", async () => {
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createClubProfessionalFeatures(),
      featuresRevision: 0,
      source: "kill_switch",
    });

    const denial = await assertExportFeatureForOrg(EXPORT_ENDPOINT_IDS.accountingFinancePaymentsCsv, "org-1");
    expect(denial).toBeNull();
    expect(
      shouldRenderExportUi(EXPORT_ENDPOINT_IDS.auditLogStream, {
        roleAllowed: true,
        permissionAllowed: true,
        organizationFeatures: createClubProfessionalFeatures(),
      })
    ).toBe(true);
  });

  it("uses runtime fallback snapshot safely", async () => {
    vi.mocked(getOrganizationFeatures).mockResolvedValueOnce({
      features: createClubProfessionalFeatures(),
      featuresRevision: 0,
      source: "repository_error_fallback",
    });

    const decision = evaluateExportFeatureAccess(
      EXPORT_ENDPOINT_IDS.fieldTestResultsCsv,
      createClubProfessionalFeatures()
    );
    expect(decision).toBe("allow");
  });

  it("skips feature evaluation for map miss (legacy export)", () => {
    expect(
      evaluateExportFeatureAccess(
        "export:legacy.unmapped" as typeof EXPORT_ENDPOINT_IDS.paymentsStream,
        createAllDisabledFeatures()
      )
    ).toBe("skip");
  });
});
