import { describe, expect, it } from "vitest";
import {
  filterPackagesEligibleForCollection,
  formatAccountingPackageOptionLabel,
  mapAccountingPackageOption,
} from "@/lib/finance/accountingPackageOptions";

describe("accountingPackageOptions", () => {
  it("excludes completed lifecycle from collection list", () => {
    const rows = filterPackagesEligibleForCollection([
      {
        id: "1",
        package_name: "A",
        remaining_lessons: 0,
        total_price: 1000,
        amount_paid: 0,
        payment_status: "unpaid",
        is_active: false,
        lifecycle_status: "completed",
        total_lessons: 10,
        used_lessons: 10,
      },
      {
        id: "2",
        package_name: "B",
        remaining_lessons: 5,
        total_price: 20_000,
        amount_paid: 2000,
        payment_status: "partial",
        is_active: true,
        lifecycle_status: "active",
        total_lessons: 10,
        used_lessons: 5,
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("2");
    expect(rows[0]?.remainingBalance).toBe(18_000);
  });

  it("formats package label with open balance", () => {
    const pkg = mapAccountingPackageOption({
      id: "2",
      package_name: "Eyüp Paket",
      remaining_lessons: 10,
      total_price: 20_000,
      amount_paid: 2000,
      payment_status: "partial",
      is_active: true,
      lifecycle_status: "active",
      total_lessons: 20,
      used_lessons: 10,
    });
    const label = formatAccountingPackageOptionLabel(pkg);
    expect(label).toContain("Eyüp Paket");
    expect(label).toContain("18.000");
    expect(label).toContain("Kalan 10 ders");
  });
});
