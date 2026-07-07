import { describe, expect, it } from "vitest";
import {
  pdfDownloadUserMessage,
  resolvePdfDownloadMethod,
} from "./pdfDownload";

describe("pdfDownload", () => {
  it("prefers share on mobile browser tabs", () => {
    expect(resolvePdfDownloadMethod({ mobile: true, standalone: false })).toBe("share");
  });

  it("keeps anchor download for installed PWA shortcuts", () => {
    expect(resolvePdfDownloadMethod({ mobile: true, standalone: true })).toBe("anchor");
  });

  it("keeps anchor download on desktop", () => {
    expect(resolvePdfDownloadMethod({ mobile: false, standalone: false })).toBe("anchor");
  });

  it("maps outcomes to user-facing messages", () => {
    expect(pdfDownloadUserMessage("downloaded", "Tek gün PDF indirildi.")).toBe(
      "Tek gün PDF indirildi."
    );
    expect(pdfDownloadUserMessage("shared", "Tek gün PDF indirildi.")).toBe(
      "Paylaşım menüsünden PDF'i kaydedebilirsiniz."
    );
    expect(pdfDownloadUserMessage("opened", "Tek gün PDF indirildi.")).toBe(
      "PDF açıldı — kaydetmek için paylaş simgesini kullanın."
    );
    expect(pdfDownloadUserMessage("cancelled", "Tek gün PDF indirildi.")).toBe(
      "Paylaşım iptal edildi."
    );
  });
});
