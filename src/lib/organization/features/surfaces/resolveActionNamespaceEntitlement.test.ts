import { describe, expect, it } from "vitest";
import { ENTITLEMENT_KEYS } from "../keys";
import { resolveActionNamespaceEntitlementKey } from "./resolveActionNamespaceEntitlement";

describe("resolveActionNamespaceEntitlementKey", () => {
  it("resolves mapped server action namespaces", () => {
    expect(resolveActionNamespaceEntitlementKey("finance.listOrgPaymentsForAdmin")).toBe(
      ENTITLEMENT_KEYS.finance
    );
    expect(resolveActionNamespaceEntitlementKey("audit.listAuditLogsForActor")).toBe(ENTITLEMENT_KEYS.audit);
    expect(resolveActionNamespaceEntitlementKey("privateLesson.createPrivateLessonSession")).toBe(
      ENTITLEMENT_KEYS.privateLessons
    );
  });

  it("returns null for unmapped action names", () => {
    expect(resolveActionNamespaceEntitlementKey("unknown.doSomething")).toBeNull();
    expect(resolveActionNamespaceEntitlementKey("invalid-format")).toBeNull();
  });
});
