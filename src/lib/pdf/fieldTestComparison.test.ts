import { describe, expect, it } from "vitest";
import {
  buildComparisonRowsResolved,
  buildFieldTestComparisonPdf,
} from "./fieldTestComparisonPdf";
import { classifyFieldTestComparison } from "@/lib/fieldTests/comparisonVerdict";

describe("fieldTestComparison", () => {
  it("higher_better: artis gelisim", () => {
    expect(classifyFieldTestComparison("higher_better", 140, 155)).toBe("improved");
  });

  it("lower_better: sprint dususu gelisim", () => {
    expect(classifyFieldTestComparison("lower_better", 4.2, 4.02)).toBe("improved");
  });

  it("eksik taraf icin yorum uretir", () => {
    const rows = buildComparisonRowsResolved([
      {
        name: "30m Sprint",
        oldDisplay: "—",
        newDisplay: "4.02",
        oldNumeric: null,
        newNumeric: 4.02,
        direction: "lower_better",
      },
    ]);
    expect(rows[0]?.comment).toBe("İlk test yok");
  });

  it("PDF uretir", async () => {
    const bytes = await buildFieldTestComparisonPdf({
      athleteName: "Test Sporcu",
      dateFrom: "2026-03-01",
      dateTo: "2026-06-01",
      rows: [
        {
          name: "30m Sprint",
          oldDisplay: "4.20",
          newDisplay: "4.02",
          oldNumeric: 4.2,
          newNumeric: 4.02,
          direction: "lower_better",
        },
      ],
    });
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");
  });
});
