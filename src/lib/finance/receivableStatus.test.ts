import { describe, expect, it } from "vitest";
import { computeReceivableStatus, RECEIVABLE_DUE_SOON_DAYS } from "@/lib/finance/receivableStatus";

describe("computeReceivableStatus", () => {
  const today = new Date("2026-05-20T12:00:00.000Z");

  it("classifies payment complete when remaining is zero", () => {
    const r = computeReceivableStatus({
      totalPrice: 1000,
      amountPaid: 1000,
      nextPaymentDueAt: "2026-05-01T00:00:00.000Z",
      today,
    });
    expect(r.status).toBe("payment_complete");
    expect(r.remainingBalance).toBe(0);
  });

  it("classifies overdue when due date is before today and balance remains", () => {
    const r = computeReceivableStatus({
      totalPrice: 1000,
      amountPaid: 200,
      nextPaymentDueAt: "2026-05-18T00:00:00.000Z",
      today,
    });
    expect(r.status).toBe("overdue");
    expect(r.daysOverdue).toBe(2);
    expect(r.remainingBalance).toBe(800);
  });

  it("classifies due soon within threshold", () => {
    const due = new Date(today.getTime() + 2 * 86_400_000); // +2 days UTC
    const r = computeReceivableStatus({
      totalPrice: 1000,
      amountPaid: 0,
      nextPaymentDueAt: due.toISOString(),
      today,
    });
    expect(r.status).toBe("due_soon");
    expect(r.daysUntilDue).toBeLessThanOrEqual(RECEIVABLE_DUE_SOON_DAYS);
  });

  it("classifies partial payment when paid but balance remains and not overdue", () => {
    const r = computeReceivableStatus({
      totalPrice: 1000,
      amountPaid: 400,
      nextPaymentDueAt: "2026-06-01T00:00:00.000Z",
      today,
    });
    expect(r.status).toBe("partial_payment");
    expect(r.remainingBalance).toBe(600);
  });

  it("classifies payment pending when nothing paid and due is not soon", () => {
    const r = computeReceivableStatus({
      totalPrice: 1000,
      amountPaid: 0,
      nextPaymentDueAt: "2026-06-15T00:00:00.000Z",
      today,
    });
    expect(r.status).toBe("payment_pending");
  });
});
