import { describe, expect, it } from "vitest";
import { PATHS } from "@/lib/navigation/routeRegistry";
import type { OfflineActionKind } from "@/lib/offline/types";
import { ENTITLEMENT_KEYS, isCanonicalEntitlementKey } from "../keys";
import {
  ACTION_NAMESPACE_ENTITLEMENT_MAP,
  ACTION_NAMESPACE_IDS,
  DASHBOARD_WIDGET_IDS,
  EXPORT_ENTITLEMENT_MAP,
  EXPORT_ENDPOINT_IDS,
  NAVIGATION_ENTITLEMENT_MAP,
  NAV_ITEM_IDS,
  OFFLINE_ENTITLEMENT_MAP,
  OFFLINE_KIND_IDS,
  QUICK_ACTION_ENTITLEMENT_MAP,
  QUICK_ACTION_IDS,
  REALTIME_ENTITLEMENT_MAP,
  REALTIME_SUBSCRIPTION_IDS,
  ROUTE_DYNAMIC_ENTITLEMENT_MAP,
  ROUTE_ENTITLEMENT_MAP,
  SNAPSHOT_BRANCH_IDS,
  SNAPSHOT_ENTITLEMENT_MAP,
  WIDGET_ENTITLEMENT_MAP,
  assertSurfaceMapContract,
  assertUniqueSurfaceMapKeys,
} from "./index";

const OFFLINE_KIND_SUFFIX_BY_ID: Record<(typeof OFFLINE_KIND_IDS)[keyof typeof OFFLINE_KIND_IDS], OfflineActionKind> = {
  [OFFLINE_KIND_IDS.wellnessDraft]: "wellness_draft",
  [OFFLINE_KIND_IDS.rpeDraft]: "rpe_draft",
  [OFFLINE_KIND_IDS.attendanceDraft]: "attendance_draft",
  [OFFLINE_KIND_IDS.fieldTestDraft]: "field_test_draft",
  [OFFLINE_KIND_IDS.coachNoteDraft]: "coach_note_draft",
  [OFFLINE_KIND_IDS.financeNoteDraft]: "finance_note_draft",
  [OFFLINE_KIND_IDS.paymentRecordDraft]: "payment_record_draft",
  [OFFLINE_KIND_IDS.privateLessonCompleteDraft]: "private_lesson_complete_draft",
  [OFFLINE_KIND_IDS.packageLifecycleDraft]: "package_lifecycle_draft",
};

describe("surface map contracts", () => {
  it("validates route entitlement map", () => {
    expect(() => assertSurfaceMapContract("ROUTE_ENTITLEMENT_MAP", ROUTE_ENTITLEMENT_MAP)).not.toThrow();
    expect(() => assertSurfaceMapContract("ROUTE_DYNAMIC_ENTITLEMENT_MAP", ROUTE_DYNAMIC_ENTITLEMENT_MAP)).not.toThrow();
    assertUniqueSurfaceMapKeys("ROUTE_ENTITLEMENT_MAP", Object.keys(ROUTE_ENTITLEMENT_MAP));
  });

  it("maps each gated PATH to a single entitlement", () => {
    for (const [path, entitlement] of Object.entries(ROUTE_ENTITLEMENT_MAP)) {
      expect(path.startsWith("/")).toBe(true);
      expect(isCanonicalEntitlementKey(entitlement)).toBe(true);
    }
    expect(Object.keys(ROUTE_ENTITLEMENT_MAP)).toContain(PATHS.finans);
    expect(ROUTE_ENTITLEMENT_MAP[PATHS.finans]).toBe(ENTITLEMENT_KEYS.finance);
  });

  it("excludes public auth-info routes from gated route map", () => {
    expect(ROUTE_ENTITLEMENT_MAP).not.toHaveProperty(PATHS.login);
    expect(ROUTE_ENTITLEMENT_MAP).not.toHaveProperty(PATHS.orgDurumu);
    expect(ROUTE_ENTITLEMENT_MAP).not.toHaveProperty(PATHS.adminAccount);
  });

  it("validates navigation entitlement map without duplicate nav ids", () => {
    expect(() => assertSurfaceMapContract("NAVIGATION_ENTITLEMENT_MAP", NAVIGATION_ENTITLEMENT_MAP)).not.toThrow();
    assertUniqueSurfaceMapKeys("NAV_ITEM_IDS", Object.values(NAV_ITEM_IDS));
    expect(Object.keys(NAVIGATION_ENTITLEMENT_MAP).length).toBe(Object.values(NAV_ITEM_IDS).length);
  });

  it("validates quick action entitlement map", () => {
    expect(() => assertSurfaceMapContract("QUICK_ACTION_ENTITLEMENT_MAP", QUICK_ACTION_ENTITLEMENT_MAP)).not.toThrow();
    assertUniqueSurfaceMapKeys("QUICK_ACTION_IDS", Object.values(QUICK_ACTION_IDS));
  });

  it("validates export entitlement map with one entitlement per endpoint", () => {
    expect(() => assertSurfaceMapContract("EXPORT_ENTITLEMENT_MAP", EXPORT_ENTITLEMENT_MAP)).not.toThrow();
    assertUniqueSurfaceMapKeys("EXPORT_ENDPOINT_IDS", Object.values(EXPORT_ENDPOINT_IDS));
    expect(EXPORT_ENTITLEMENT_MAP[EXPORT_ENDPOINT_IDS.auditLogStream]).toBe(ENTITLEMENT_KEYS.audit);
  });

  it("validates offline entitlement map for every offline kind", () => {
    expect(() => assertSurfaceMapContract("OFFLINE_ENTITLEMENT_MAP", OFFLINE_ENTITLEMENT_MAP)).not.toThrow();
    assertUniqueSurfaceMapKeys("OFFLINE_KIND_IDS", Object.values(OFFLINE_KIND_IDS));
    expect(Object.keys(OFFLINE_ENTITLEMENT_MAP).length).toBe(Object.values(OFFLINE_KIND_SUFFIX_BY_ID).length);
  });

  it("validates realtime entitlement map", () => {
    expect(() => assertSurfaceMapContract("REALTIME_ENTITLEMENT_MAP", REALTIME_ENTITLEMENT_MAP)).not.toThrow();
    assertUniqueSurfaceMapKeys("REALTIME_SUBSCRIPTION_IDS", Object.values(REALTIME_SUBSCRIPTION_IDS));
  });

  it("validates snapshot branch entitlement map", () => {
    expect(() => assertSurfaceMapContract("SNAPSHOT_ENTITLEMENT_MAP", SNAPSHOT_ENTITLEMENT_MAP)).not.toThrow();
    assertUniqueSurfaceMapKeys("SNAPSHOT_BRANCH_IDS", Object.values(SNAPSHOT_BRANCH_IDS));
  });

  it("validates widget entitlement map without duplicate widget ids", () => {
    expect(() => assertSurfaceMapContract("WIDGET_ENTITLEMENT_MAP", WIDGET_ENTITLEMENT_MAP)).not.toThrow();
    assertUniqueSurfaceMapKeys("DASHBOARD_WIDGET_IDS", Object.values(DASHBOARD_WIDGET_IDS));
  });

  it("validates action namespace map without duplicate namespaces", () => {
    expect(() => assertSurfaceMapContract("ACTION_NAMESPACE_ENTITLEMENT_MAP", ACTION_NAMESPACE_ENTITLEMENT_MAP)).not.toThrow();
    assertUniqueSurfaceMapKeys("ACTION_NAMESPACE_IDS", Object.values(ACTION_NAMESPACE_IDS));
  });

  it("uses only ENTITLEMENT_KEYS constants in route map values", () => {
    const canonicalValues = new Set(Object.values(ENTITLEMENT_KEYS));
    for (const entitlement of Object.values(ROUTE_ENTITLEMENT_MAP)) {
      expect(canonicalValues.has(entitlement)).toBe(true);
    }
  });

  it("fails contract validation for unknown entitlement strings", () => {
    expect(() =>
      assertSurfaceMapContract("TEST_MAP", {
        "test:key": "not_a_real_entitlement" as never,
      })
    ).toThrow(/unknown entitlement/i);
  });

  it("fails contract validation when entitlement is absent from catalog", () => {
    expect(() =>
      assertSurfaceMapContract("TEST_MAP", {
        "test:key": "insight" as never,
      })
    ).toThrow(/unknown entitlement|missing from catalog/i);
  });
});

describe("surface map magic string guard", () => {
  it("does not embed raw entitlement literals outside ENTITLEMENT_KEYS in map modules", () => {
    const allMaps = [
      ROUTE_ENTITLEMENT_MAP,
      ROUTE_DYNAMIC_ENTITLEMENT_MAP,
      NAVIGATION_ENTITLEMENT_MAP,
      QUICK_ACTION_ENTITLEMENT_MAP,
      EXPORT_ENTITLEMENT_MAP,
      OFFLINE_ENTITLEMENT_MAP,
      REALTIME_ENTITLEMENT_MAP,
      SNAPSHOT_ENTITLEMENT_MAP,
      WIDGET_ENTITLEMENT_MAP,
      ACTION_NAMESPACE_ENTITLEMENT_MAP,
    ];

    const canonicalValues = new Set(Object.values(ENTITLEMENT_KEYS));
    for (const map of allMaps) {
      for (const entitlement of Object.values(map)) {
        expect(canonicalValues.has(entitlement)).toBe(true);
        expect(isCanonicalEntitlementKey(entitlement)).toBe(true);
      }
    }
  });
});
