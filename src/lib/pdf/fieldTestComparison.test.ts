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

  it("uzun metin satirlarinda PDF uretir", async () => {
    const longPosture =
      "FORWARD HEAD, ANKLE MOBILITY, HIP MOBILITY, THORACIC MOBILITY, SHOULDER MOBILITY, CORE STABILITY, BALANCE, PROPRIOCEPTION";
    const bytes = await buildFieldTestComparisonPdf({
      athleteName: "Levent Sarikaya",
      dateFrom: "2026-01-03",
      dateTo: "2026-04-25",
      rows: [
        {
          name: "POSTUR ANALIZI",
          oldDisplay: longPosture,
          newDisplay: longPosture,
          direction: "lower_better",
          isText: true,
        },
        {
          name: "OVER HEAD SQUAT",
          oldDisplay: "1 ( AYAK BILEGI KISITLILIGI, HIP MOBILITY, THORACIC MOBILITY )",
          newDisplay: "1 ( AYAK BILEGI KISITLILIGI, HIP MOBILITY, THORACIC MOBILITY )",
          direction: "lower_better",
          isText: true,
        },
        {
          name: "LUNGE",
          oldDisplay: "SAG: 2 SOL: 2 (DENGESIZLIK, HIP MOBILITY, CORE STABILITY)",
          newDisplay: "SAG: 2 SOL: 2 (DENGESIZLIK, HIP MOBILITY, CORE STABILITY)",
          direction: "lower_better",
          isText: true,
        },
        {
          name: "THOMAS TEST",
          oldDisplay: "SAG: NORMAL SOL: NORMAL",
          newDisplay: "SAG: NORMAL SOL: NORMAL",
          direction: "lower_better",
          isText: true,
        },
        {
          name: "OMUZ",
          oldDisplay: "45",
          newDisplay: "50",
          oldNumeric: 45,
          newNumeric: 50,
          direction: "higher_better",
        },
      ],
    });
    expect(bytes.length).toBeGreaterThan(500);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("%PDF");
    expect(buildComparisonRowsResolved([
      {
        name: "POSTUR ANALIZI",
        oldDisplay: longPosture,
        newDisplay: longPosture,
        direction: "lower_better",
        isText: true,
      },
    ])[0]?.comment).toBe("Değişim yok");
  });
});
