import { describe, expect, it } from "vitest";
import { diagnosticsCode, isTechnicalErrorMessage, operationalError } from "@/lib/ui/operationalErrors";

describe("operationalErrors", () => {
  it("builds diagnostics codes", () => {
    expect(diagnosticsCode("fin", "fetch_error")).toBe("FIN-FETCH_ERROR");
  });

  it("hides schema drift from user copy", () => {
    const msg = operationalError("Ödeme geçmişi alınamadı", {
      rawMessage: 'column "voided_at" does not exist',
      code: "FIN-PLP",
    });
    expect(msg).toContain("şema uyumluluk");
    expect(msg).not.toContain("voided_at");
    expect(msg).toContain("Tanı: FIN-PLP");
  });

  it("flags technical messages", () => {
    expect(isTechnicalErrorMessage("column x does not exist")).toBe(true);
    expect(isTechnicalErrorMessage("Sporcu bulunamadı")).toBe(false);
  });
});
