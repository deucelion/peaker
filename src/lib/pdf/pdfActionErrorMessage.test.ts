import { describe, expect, it } from "vitest";
import { firstPdfActionErrorMessage, pdfTaskErrorMessage } from "./pdfActionErrorMessage";

describe("pdfActionErrorMessage", () => {
  it("returns the first server action error", () => {
    expect(
      firstPdfActionErrorMessage([
        { orgName: "Demo" },
        { error: "Saha testleri icin rapor goruntuleme yetkiniz yok." },
      ])
    ).toBe("Saha testleri icin rapor goruntuleme yetkiniz yok.");
  });

  it("surfaces Error.message for pdf task failures", () => {
    expect(pdfTaskErrorMessage(new Error("Font yüklenemedi"), "PDF oluşturulamadı.")).toBe(
      "Font yüklenemedi"
    );
    expect(pdfTaskErrorMessage({}, "PDF oluşturulamadı.")).toBe("PDF oluşturulamadı.");
  });
});
