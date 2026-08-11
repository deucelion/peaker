import { describe, expect, it } from "vitest";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import { mergeBranding } from "@/lib/organization/branding/helpers";
import { hexColorToPdfRgb, resolvePdfHeaderColorRgb } from "./pdfBrandingColors";

describe("pdfBrandingColors", () => {
  it("maps default organization primary to pdf header rgb", () => {
    expect(resolvePdfHeaderColorRgb(createDefaultBranding())).toEqual([124, 58, 237]);
  });

  it("maps custom organization primary to pdf header rgb", () => {
    expect(
      resolvePdfHeaderColorRgb(
        mergeBranding(createDefaultBranding(), {
          theme: { primary: "#112233" },
        })
      )
    ).toEqual([17, 34, 51]);
  });

  it("falls back to default rgb for invalid hex", () => {
    expect(hexColorToPdfRgb("not-a-color")).toEqual([124, 58, 237]);
  });
});
