import { describe, expect, it } from "vitest";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import { mergeBranding } from "@/lib/organization/branding/helpers";
import { resolvePdfBranding } from "@/lib/organization/branding/surfaces/resolvePdfBranding";
import {
  createDefaultPdfBrandingPresentation,
  createPdfBrandingPresentation,
  createPdfBrandingPresentationFromOrganizationBranding,
} from "./pdfBrandingPresentation";
import {
  createDefaultOrganizationBrandingPresentation,
  createOrganizationBrandingPresentation,
} from "./organizationBrandingPresentation";

describe("pdfBrandingPresentation", () => {
  it("creates pdf title presentation from snapshot", () => {
    const presentation = createPdfBrandingPresentation(
      resolvePdfBranding(
        mergeBranding(createDefaultBranding(), {
          pdf: { title: "Atlas Club Rapor" },
        })
      )
    );

    expect(presentation).toEqual({ title: "Atlas Club Rapor" });
    expect(Object.keys(presentation)).toEqual(["title"]);
  });

  it("falls back to default pdf title presentation", () => {
    expect(createDefaultPdfBrandingPresentation().title).toBe("PEAKER Rapor");
  });

  it("creates pdf presentation from organizationBranding snapshot", () => {
    const presentation = createPdfBrandingPresentationFromOrganizationBranding(createDefaultBranding());
    expect(presentation.title).toBe("PEAKER Rapor");
  });
});

describe("organizationBrandingPresentation pdf bundle", () => {
  it("includes pdf presentation in organization branding bundle", () => {
    const bundle = createOrganizationBrandingPresentation(createDefaultBranding());
    expect(bundle.pdf.title).toBe("PEAKER Rapor");
    expect(Object.keys(bundle).sort()).toEqual(["email", "favicon", "logo", "metadata", "pdf"].sort());
  });

  it("includes runtime pdf title in organization branding bundle", () => {
    const bundle = createOrganizationBrandingPresentation(
      mergeBranding(createDefaultBranding(), {
        pdf: { title: "Custom PDF" },
      })
    );
    expect(bundle.pdf.title).toBe("Custom PDF");
  });

  it("preserves default bundle parity for pdf title", () => {
    expect(createDefaultOrganizationBrandingPresentation().pdf).toEqual(createDefaultPdfBrandingPresentation());
  });
});
