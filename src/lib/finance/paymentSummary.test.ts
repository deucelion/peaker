import { describe, expect, it } from "vitest";
import type { PaymentRow } from "@/types/domain";
import { computeFinanceStatusSummary } from "@/lib/finance/paymentSummary";

function aidatRow(overrides: Partial<PaymentRow> = {}): PaymentRow {
  return {
    id: "p1",
    profile_id: "a1",
    amount: 500,
    payment_type: "aylik",
    status: "odendi",
    due_date: "2026-06-01",
    ...overrides,
  } as PaymentRow;
}

describe("computeFinanceStatusSummary — package open balance", () => {
  it("does not show Borç Bulunmuyor when package open balance > 0 and no aidat debt", () => {
    const summary = computeFinanceStatusSummary({
      aidatPayments: [aidatRow({ status: "odendi" })],
      packageOpenBalance: 18_000,
    });
    expect(summary.label).not.toBe("Borç Bulunmuyor");
    expect(summary.label).toBe("Açık Bakiye Var");
  });

  it("shows Borç Bulunmuyor when package and aidat balances are clear", () => {
    const summary = computeFinanceStatusSummary({
      aidatPayments: [aidatRow({ status: "odendi" })],
      packageOpenBalance: 0,
    });
    expect(summary.label).toBe("Borç Bulunmuyor");
  });

  it("keeps Gecikmiş Ödeme when aidat is overdue even with package balance", () => {
    const summary = computeFinanceStatusSummary({
      aidatPayments: [aidatRow({ status: "bekliyor", due_date: "2026-01-01" })],
      packageOpenBalance: 18_000,
    });
    expect(summary.label).toBe("Gecikmiş Ödeme");
    expect(summary.tone).toBe("overdue");
  });

  it("shows Kısmi Ödeme when partial package flag without open balance edge", () => {
    const summary = computeFinanceStatusSummary({
      aidatPayments: [],
      hasPartialPackagePayment: true,
      packageOpenBalance: 600,
    });
    expect(summary.label).toBe("Açık Bakiye Var");
  });
});
