import { describe, expect, it } from "vitest";
import {
  assertEndsNotBeforeStart,
  evaluateLicenseWindowBlock,
  LICENSE_PENDING_GATE_STATUS,
  organizationGateStatusFromLicenseBlock,
  superAdminLicenseSignal,
} from "./license";

describe("organization license window", () => {
  it("evaluateLicenseWindowBlock: future start blocks active", () => {
    const start = new Date(Date.now() + 86400000).toISOString();
    expect(evaluateLicenseWindowBlock("active", start, null, Date.now())).toBe("license_pending");
  });

  it("evaluateLicenseWindowBlock: past end blocks active", () => {
    const end = new Date(Date.now() - 86400000).toISOString();
    expect(evaluateLicenseWindowBlock("active", null, end, Date.now())).toBe("expired_by_window");
  });

  it("evaluateLicenseWindowBlock: suspended ignores dates", () => {
    const end = new Date(Date.now() - 86400000).toISOString();
    expect(evaluateLicenseWindowBlock("suspended", null, end, Date.now())).toBeNull();
  });

  it("organizationGateStatusFromLicenseBlock maps to gate statuses", () => {
    expect(organizationGateStatusFromLicenseBlock("license_pending")).toBe(LICENSE_PENDING_GATE_STATUS);
    expect(organizationGateStatusFromLicenseBlock("expired_by_window")).toBe("expired");
  });

  it("assertEndsNotBeforeStart", () => {
    const a = assertEndsNotBeforeStart("2026-01-02T00:00:00.000Z", "2026-01-01T00:00:00.000Z");
    expect(a.ok).toBe(false);
    expect(assertEndsNotBeforeStart(null, "2026-01-01T00:00:00.000Z").ok).toBe(true);
    expect(assertEndsNotBeforeStart("2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z").ok).toBe(true);
  });

  it("superAdminLicenseSignal expiring_soon", () => {
    const nowMs = Date.UTC(2026, 5, 1, 12, 0, 0);
    const ends = new Date(Date.UTC(2026, 5, 5, 12, 0, 0)).toISOString();
    const sig = superAdminLicenseSignal("active", null, ends, nowMs);
    expect(sig.kind).toBe("expiring_soon");
    if (sig.kind === "expiring_soon") expect(sig.daysLeft).toBe(4);
  });
});
