import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import { mergeBranding } from "@/lib/organization/branding/helpers";
import { BrandingUiProvider } from "./BrandingUiProvider";
import { createBrandingUiContextValue } from "./BrandingUiContext";

describe("BrandingUiProvider", () => {
  it("renders children in isolation without throwing", () => {
    const markup = renderToStaticMarkup(
      createElement(
        BrandingUiProvider,
        { organizationBranding: createDefaultBranding() },
        createElement("span", null, "branded-content")
      )
    );

    expect(markup).toContain("branded-content");
    expect(markup).toContain("data-peaker-ui-content-root");
    expect(markup).toContain("--peaker-ui-PRIMARY");
  });

  it("creates context value from custom branding snapshot", () => {
    const branding = mergeBranding(createDefaultBranding(), {
      brandingRevision: 4,
      theme: {
        ...createDefaultBranding().theme,
        primary: "#112233",
      },
    });

    const value = createBrandingUiContextValue({ organizationBranding: branding });
    expect(value.brandingRevision).toBe(4);
    expect(value.selectorMatrix.primary.background).toBe("#112233");
    expect(value.classes.button.primary).toBe("ui-btn-primary");
  });

  it("falls back to default branding for invalid snapshot input", () => {
    const value = createBrandingUiContextValue({ organizationBranding: { not: "branding" } });
    expect(value.organizationBranding.theme.primary).toBe("#7c3aed");
    expect(value.selectorMatrix.primary.background).toBe("#7c3aed");
  });
});
