import { describe, expect, it } from "vitest";
import { computeReceivableAgingBuckets } from "@/lib/finance/receivableAging";
import type { ReceivablePackageRow } from "@/lib/actions/receivableDashboardActions";

function row(partial: Partial<ReceivablePackageRow> & Pick<ReceivablePackageRow, "daysOverdue" | "remainingBalance">): ReceivablePackageRow {
  return {
    packageId: "p1",
    packageName: "Paket",
    athleteId: "a1",
    athleteName: "Sporcu",
    athleteTeam: null,
    totalPrice: 1000,
    amountPaid: 0,
    paymentStatus: "unpaid",
    lifecycleStatus: "active",
    nextPaymentDueAt: null,
    receivableStatus: "overdue",
    receivableLabel: "Gecikmiş",
    receivableTone: "red",
    daysUntilDue: null,
    ...partial,
  };
}

describe("computeReceivableAgingBuckets", () => {
  it("groups overdue packages by days overdue", () => {
    const buckets = computeReceivableAgingBuckets([
      row({ daysOverdue: 10, remainingBalance: 100 }),
      row({ daysOverdue: 45, remainingBalance: 200, packageId: "p2" }),
      row({ daysOverdue: 75, remainingBalance: 300, packageId: "p3" }),
      row({ daysOverdue: 120, remainingBalance: 400, packageId: "p4" }),
      row({ daysOverdue: 5, remainingBalance: 50, packageId: "p5", receivableStatus: "due_soon" }),
    ]);

    expect(buckets.find((b) => b.key === "0-30")).toMatchObject({ count: 1, amount: 100 });
    expect(buckets.find((b) => b.key === "31-60")).toMatchObject({ count: 1, amount: 200 });
    expect(buckets.find((b) => b.key === "61-90")).toMatchObject({ count: 1, amount: 300 });
    expect(buckets.find((b) => b.key === "90+")).toMatchObject({ count: 1, amount: 400 });
  });
});
