import { describe, expect, it } from "vitest";
import {
  canCancelPackage,
  canRefundPackage,
  derivePackageLifecycleStatus,
  packageAllowsNewSessions,
  packageAllowsPayment,
} from "@/lib/privateLessons/packageStatus";

describe("package lifecycle", () => {
  it("derives active when lessons remain", () => {
    expect(
      derivePackageLifecycleStatus({
        isActive: true,
        remainingLessons: 3,
        totalLessons: 8,
        usedLessons: 5,
      })
    ).toBe("active");
  });

  it("derives completed when inactive and no remaining lessons", () => {
    expect(
      derivePackageLifecycleStatus({
        isActive: false,
        remainingLessons: 0,
        totalLessons: 8,
        usedLessons: 8,
      })
    ).toBe("completed");
  });

  it("blocks sessions when not active", () => {
    expect(packageAllowsNewSessions("paused")).toBe(false);
    expect(packageAllowsNewSessions("active")).toBe(true);
  });

  it("blocks payment when completed", () => {
    expect(packageAllowsPayment("completed")).toBe(false);
    expect(packageAllowsPayment("paused")).toBe(true);
    expect(packageAllowsPayment("refunded")).toBe(false);
  });

  it("canCancel and canRefund rules", () => {
    expect(canCancelPackage("active")).toBe(true);
    expect(canCancelPackage("refunded")).toBe(false);
    expect(canRefundPackage("cancelled")).toBe(true);
  });
});
