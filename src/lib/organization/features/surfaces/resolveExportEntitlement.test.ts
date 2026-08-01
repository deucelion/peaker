import { describe, expect, it } from "vitest";
import { ENTITLEMENT_KEYS } from "../keys";
import { EXPORT_ENDPOINT_IDS } from "./exportEntitlementMap";
import { resolveExportEntitlementKey } from "./resolveExportEntitlement";

describe("resolveExportEntitlementKey", () => {
  it("resolves mapped export endpoint ids", () => {
    expect(resolveExportEntitlementKey(EXPORT_ENDPOINT_IDS.paymentsStream)).toBe(ENTITLEMENT_KEYS.finance);
    expect(resolveExportEntitlementKey(EXPORT_ENDPOINT_IDS.auditLogStream)).toBe(ENTITLEMENT_KEYS.audit);
    expect(resolveExportEntitlementKey(EXPORT_ENDPOINT_IDS.performanceSummaryCsv)).toBe(
      ENTITLEMENT_KEYS.insightPerformance
    );
    expect(resolveExportEntitlementKey(EXPORT_ENDPOINT_IDS.fieldTestResultsCsv)).toBe(
      ENTITLEMENT_KEYS.insightFieldTests
    );
  });

  it("returns entitlement for every registered export endpoint id", () => {
    for (const exportId of Object.values(EXPORT_ENDPOINT_IDS)) {
      expect(resolveExportEntitlementKey(exportId)).not.toBeNull();
    }
  });

  it("returns null for map miss (legacy export path)", () => {
    expect(resolveExportEntitlementKey("export:legacy.unmapped" as typeof EXPORT_ENDPOINT_IDS.paymentsStream)).toBeNull();
  });
});
