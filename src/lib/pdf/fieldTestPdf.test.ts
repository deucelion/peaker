import { describe, expect, it } from "vitest";
import { buildFieldTestSingleDatePdf, fieldTestSingleDatePdfFilename } from "./fieldTestPdf";

describe("fieldTestPdf", () => {
  it("uretilen PDF %PDF ile baslar", async () => {
    const bytes = await buildFieldTestSingleDatePdf({
      orgName: "Test Akademi",
      athlete: {
        fullName: "Ali Veli",
        testDate: "2026-06-02",
        heightCm: 180,
        weightKg: 75,
      },
      numericMetrics: [{ name: "30m Sprint", value: "4.02", unit: "sn" }],
      textMetrics: [{ name: "Postür Analizi", value: "Normal" }],
      generalNote: "Genel not",
    });
    const head = String.fromCharCode(...bytes.slice(0, 4));
    expect(head).toBe("%PDF");
    expect(bytes.length).toBeGreaterThan(500);
  });

  it("filename Turkce karakterleri sluglar", () => {
    expect(fieldTestSingleDatePdfFilename("Ali Veli", "2026-06-02")).toContain("2026-06-02");
    expect(fieldTestSingleDatePdfFilename("Şükrü Çağlar", "2026-06-02")).not.toContain("ş");
  });
});
