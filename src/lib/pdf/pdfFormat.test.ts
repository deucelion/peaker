import { describe, expect, it } from "vitest";
import { formatPdfMetricUnit, formatPdfPersonName, isValidPdfChartImage } from "./pdfFormat";

describe("pdfFormat", () => {
  it("title-cases person names", () => {
    expect(formatPdfPersonName("eyüp akhan")).toBe("Eyüp Akhan");
  });

  it("fixes index metric units", () => {
    expect(formatPdfMetricUnit("RSI", "CM")).toBe("indeks");
    expect(formatPdfMetricUnit("DJ", "cm")).toBe("indeks");
    expect(formatPdfMetricUnit("CMJ", "CM")).toBe("CM");
  });

  it("validates chart image data urls", () => {
    expect(isValidPdfChartImage(null)).toBe(false);
    expect(isValidPdfChartImage("data:image/png;base64,abc")).toBe(false);
    expect(isValidPdfChartImage(`data:image/png;base64,${"a".repeat(300)}`)).toBe(true);
  });
});
