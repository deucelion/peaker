import { describe, expect, it } from "vitest";
import {
  assertLifecycleTransition,
  canArchiveOrganizationStatus,
  canReactivateOrganizationStatus,
  canSuspendOrganizationStatus,
  orgStatusBlocksProductAccess,
  parseOrganizationStatus,
} from "./lifecycle";

describe("organization lifecycle", () => {
  it("parses known statuses and defaults unknown to active", () => {
    expect(parseOrganizationStatus("suspended")).toBe("suspended");
    expect(parseOrganizationStatus(null)).toBe("active");
    expect(parseOrganizationStatus("nope")).toBe("active");
  });

  it("blocks product access for suspended, archived, expired", () => {
    expect(orgStatusBlocksProductAccess("suspended")).toBe(true);
    expect(orgStatusBlocksProductAccess("archived")).toBe(true);
    expect(orgStatusBlocksProductAccess("expired")).toBe(true);
    expect(orgStatusBlocksProductAccess("active")).toBe(false);
    expect(orgStatusBlocksProductAccess("trial")).toBe(false);
  });

  it("suspend allowed from active and trial only", () => {
    expect(canSuspendOrganizationStatus("active")).toBe(true);
    expect(canSuspendOrganizationStatus("trial")).toBe(true);
    expect(canSuspendOrganizationStatus("suspended")).toBe(false);
  });

  it("archive allowed except when already archived", () => {
    expect(canArchiveOrganizationStatus("archived")).toBe(false);
    expect(canArchiveOrganizationStatus("active")).toBe(true);
  });

  it("reactivate allowed from suspended, archived, expired", () => {
    expect(canReactivateOrganizationStatus("suspended")).toBe(true);
    expect(canReactivateOrganizationStatus("archived")).toBe(true);
    expect(canReactivateOrganizationStatus("expired")).toBe(true);
    expect(canReactivateOrganizationStatus("active")).toBe(false);
  });

  it("assertLifecycleTransition returns expected next status", () => {
    expect(assertLifecycleTransition("suspend", "active")).toEqual({ ok: true, next: "suspended" });
    expect(assertLifecycleTransition("archive", "suspended")).toEqual({ ok: true, next: "archived" });
    expect(assertLifecycleTransition("reactivate", "archived")).toEqual({ ok: true, next: "active" });
    expect(assertLifecycleTransition("suspend", "archived").ok).toBe(false);
  });
});
