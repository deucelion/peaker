import { describe, expect, it } from "vitest";
import {
  canCancelPackage,
  canRefundPackage,
  derivePackageLifecycleStatus,
  packageAllowsCoreEdit,
  packageAllowsNewSessions,
  packageAllowsPayment,
  resolveLifecycleAfterCoreUpdate,
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

describe("core edit lifecycle (pazarlık / ders hediye)", () => {
  it("tamamlanmış pakete ders eklenince yeniden aktifleşir", () => {
    expect(
      resolveLifecycleAfterCoreUpdate({
        current: "completed",
        isActiveRequested: true,
        nextRemaining: 2,
      })
    ).toBe("active");
  });

  it("ders eklenmeden tamamlanmış paket completed kalır", () => {
    expect(
      resolveLifecycleAfterCoreUpdate({
        current: "completed",
        isActiveRequested: true,
        nextRemaining: 0,
      })
    ).toBe("completed");
  });

  it("aktif paketten ders azaltılıp sıfıra inerse completed olur", () => {
    expect(
      resolveLifecycleAfterCoreUpdate({
        current: "active",
        isActiveRequested: true,
        nextRemaining: 0,
      })
    ).toBe("completed");
  });

  it("aktif istek false ise kalan ders olsa da paused olur", () => {
    expect(
      resolveLifecycleAfterCoreUpdate({
        current: "active",
        isActiveRequested: false,
        nextRemaining: 3,
      })
    ).toBe("paused");
  });

  it("donmuş paket aktif istek ile yeniden aktifleşir", () => {
    expect(
      resolveLifecycleAfterCoreUpdate({
        current: "paused",
        isActiveRequested: true,
        nextRemaining: 3,
      })
    ).toBe("active");
  });

  it("iptal/iade edilmiş paket düzenlenemez ve durumu değişmez", () => {
    expect(packageAllowsCoreEdit("cancelled")).toBe(false);
    expect(packageAllowsCoreEdit("refunded")).toBe(false);
    expect(packageAllowsCoreEdit("completed")).toBe(true);
    expect(packageAllowsCoreEdit("active")).toBe(true);
    expect(
      resolveLifecycleAfterCoreUpdate({
        current: "cancelled",
        isActiveRequested: true,
        nextRemaining: 5,
      })
    ).toBe("cancelled");
  });
});
