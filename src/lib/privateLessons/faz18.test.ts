import { describe, expect, it } from "vitest";
import { assertValidTRYMoneyAmount, calculatePackageFinanceSummary } from "@/lib/privateLessons/packageFinance";
import { parseTRYMoneyInput } from "@/lib/privateLessons/packageMath";
import {
  canFreezePackage,
  canRefundPackage,
  canResumePackage,
  derivePackageLifecycleStatus,
  packageAllowsPayment,
  packageAllowsUsage,
  resolvePackageLifecycleStatus,
} from "@/lib/privateLessons/packageStatus";
import { buildPackageUsageLessonRows } from "@/lib/privateLessons/packageUsageLessonRows";

describe("FAZ 18 — money validation", () => {
  it("rejects NaN, zero, negative, and huge amounts", () => {
    expect(assertValidTRYMoneyAmount(Number.NaN).ok).toBe(false);
    expect(assertValidTRYMoneyAmount(0).ok).toBe(false);
    expect(assertValidTRYMoneyAmount(-1).ok).toBe(false);
    expect(assertValidTRYMoneyAmount(1e12).ok).toBe(false);
    expect(assertValidTRYMoneyAmount(100).ok).toBe(true);
  });

  it("parseTRYMoneyInput handles Turkish thousands", () => {
    expect(parseTRYMoneyInput("10.000")).toBe(10000);
  });
});

describe("FAZ 18 — lifecycle transitions", () => {
  it("can freeze only active", () => {
    expect(canFreezePackage("active")).toBe(true);
    expect(canFreezePackage("paused")).toBe(false);
  });

  it("can resume only paused", () => {
    expect(canResumePackage("paused")).toBe(true);
    expect(canResumePackage("active")).toBe(false);
  });

  it("prefers stored lifecycle_status", () => {
    expect(
      resolvePackageLifecycleStatus({
        lifecycleStatus: "refunded",
        isActive: true,
        remainingLessons: 5,
        totalLessons: 8,
        usedLessons: 3,
      })
    ).toBe("refunded");
  });

  it("paused allows payment not usage", () => {
    expect(packageAllowsPayment("paused")).toBe(true);
    expect(packageAllowsUsage("paused")).toBe(false);
    expect(packageAllowsPayment("cancelled")).toBe(false);
    expect(canRefundPackage("completed")).toBe(true);
  });
});

describe("FAZ 18 — finance summary", () => {
  it("never returns negative remaining balance", () => {
    const summary = calculatePackageFinanceSummary({
      pkg: {
        totalPrice: 1000,
        amountPaid: 1200,
        paymentStatus: "paid",
        installmentCount: null,
        installmentIntervalDays: null,
        nextPaymentDueAt: null,
      },
      payments: [],
    });
    expect(summary.remainingBalance).toBe(0);
  });

  it("flags installment overdue when due passed and balance remains", () => {
    const summary = calculatePackageFinanceSummary({
      pkg: {
        totalPrice: 10000,
        amountPaid: 2000,
        paymentStatus: "partial",
        installmentCount: 4,
        installmentIntervalDays: 30,
        nextPaymentDueAt: new Date(Date.now() - 86400000).toISOString(),
      },
      payments: [],
      now: new Date(),
    });
    expect(summary.installmentOverdue).toBe(true);
  });
});

describe("FAZ 18 — usage lesson rows", () => {
  it("merges sessions and manual usage", () => {
    const rows = buildPackageUsageLessonRows({
      packageAthleteName: "Ali",
      usageRows: [{ id: "u1", used_at: "2026-01-02T10:00:00Z", note: "Manuel" }],
      completedSessions: [
        {
          id: "s1",
          starts_at: "2026-01-01T10:00:00Z",
          status: "completed",
          athlete_profile: { full_name: "Ali" },
        },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows.some((r) => r.source === "usage")).toBe(true);
    expect(rows.some((r) => r.source === "session")).toBe(true);
  });
});

describe("FAZ 18 — derive fallback", () => {
  it("derives paused when inactive with remaining lessons", () => {
    expect(
      derivePackageLifecycleStatus({
        isActive: false,
        remainingLessons: 2,
        totalLessons: 8,
        usedLessons: 6,
      })
    ).toBe("paused");
  });
});
