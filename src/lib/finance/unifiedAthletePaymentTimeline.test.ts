import { describe, expect, it } from "vitest";
import { buildUnifiedAthletePaymentTimeline } from "@/lib/finance/unifiedAthletePaymentTimeline";
import type { PaymentRow } from "@/types/domain";
import type { PrivateLessonPackage, PrivateLessonPayment } from "@/lib/types/privateLesson";

describe("buildUnifiedAthletePaymentTimeline", () => {
  it("merges aidat, package ledger, and skips duplicate legacy package row by day+amount", () => {
    const aidatPayments: PaymentRow[] = [
      {
        id: "a1",
        profile_id: "p1",
        organization_id: "o1",
        amount: 100,
        payment_type: "aylik",
        payment_scope: "membership",
        payment_kind: "monthly_membership",
        due_date: "2026-05-01",
        payment_date: "2026-05-01T10:00:00.000Z",
        status: "odendi",
        total_sessions: null,
        remaining_sessions: null,
        description: null,
      },
    ];
    const privateLessonPayments: PrivateLessonPayment[] = [
      {
        id: "lp1",
        packageId: "pkg1",
        athleteId: "p1",
        coachId: null,
        amount: 18000,
        paidAt: "2026-05-02T09:00:00.000Z",
        note: "Onboarding ilk ödeme",
        createdBy: null,
        createdAt: "2026-05-02T09:00:00.000Z",
      },
    ];
    const legacyPackagePayments: PaymentRow[] = [
      {
        id: "leg1",
        profile_id: "p1",
        organization_id: "o1",
        amount: 18000,
        payment_type: "paket",
        payment_scope: "private_lesson",
        payment_kind: "private_lesson_package",
        due_date: "2026-05-02",
        payment_date: "2026-05-02T09:00:00.000Z",
        status: "odendi",
        total_sessions: null,
        remaining_sessions: null,
        description: null,
      },
    ];
    const privateLessonPackages: PrivateLessonPackage[] = [
      {
        id: "pkg1",
        organizationId: "o1",
        athleteId: "p1",
        athleteName: "Test",
        coachId: null,
        coachName: null,
        packageType: "private",
        packageName: "Test Paketi",
        totalLessons: 10,
        usedLessons: 0,
        remainingLessons: 10,
        totalPrice: 20000,
        amountPaid: 18000,
        paymentStatus: "partial",
        isActive: true,
        createdAt: "2026-05-02T09:00:00.000Z",
        updatedAt: "2026-05-02T09:00:00.000Z",
      },
    ];

    const lines = buildUnifiedAthletePaymentTimeline({
      aidatPayments,
      legacyPackagePayments,
      privateLessonPayments,
      privateLessonPackages,
    });

    const legacyIncluded = lines.some((l) => l.refKind === "payment" && l.refId === "leg1");
    expect(legacyIncluded).toBe(false);
    const plpIncluded = lines.some((l) => l.refKind === "private_lesson_payment" && l.refId === "lp1");
    expect(plpIncluded).toBe(true);
    const onboardingLine = lines.find((l) => l.refId === "lp1");
    expect(onboardingLine?.sourceBadge).toBe("Kaynak: Onboarding");
    expect(lines.some((l) => l.refId === "a1")).toBe(true);
  });
});
