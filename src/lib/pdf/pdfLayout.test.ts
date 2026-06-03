import { describe, expect, it } from "vitest";
import { formatAcwrDisplay, formatEwmaDisplay } from "./pdfLayout";

describe("pdfLayout", () => {
  it("formats acwr and ewma display", () => {
    expect(formatAcwrDisplay(1.052)).toBe("1.05");
    expect(formatAcwrDisplay(0)).toBe("—");
    expect(formatEwmaDisplay(0.98)).toBe("0.98");
  });
});
