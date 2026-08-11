import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import { mergeBranding } from "@/lib/organization/branding/helpers";
import { BRANDING_COLOR_TOKEN_KEY_LIST, BRANDING_COLOR_TOKEN_KEYS } from "@/lib/organization/branding/tokens";
import { BrandingUiProvider } from "./BrandingUiProvider";
import { createBrandingUiContextValue } from "./BrandingUiContext";
import { UI_CONTENT_THEME_CSS_VAR_PREFIX } from "./UI_CONTENT_THEME_VARS";

const REQUIRED_CONTEXT_FIELDS = [
  "ready",
  "brandingRevision",
  "organizationBranding",
  "tokens",
  "contentThemeVars",
  "selectors",
  "selectorMatrix",
  "classes",
] as const;

/** CI parity gate: BrandingUiProvider contract for default org snapshot. */
export function runBrandingProviderContractParityGate():
  | { ok: true }
  | { ok: false; message: string } {
  const value = createBrandingUiContextValue({ organizationBranding: createDefaultBranding() });

  for (const field of REQUIRED_CONTEXT_FIELDS) {
    if (!(field in value)) {
      return { ok: false, message: `BrandingUiContext missing required field: ${field}.` };
    }
  }

  if (value.brandingRevision !== 0) {
    return { ok: false, message: "Default brandingRevision must be 0 in provider context." };
  }

  for (const themeKey of BRANDING_COLOR_TOKEN_KEY_LIST) {
    const canonicalKey = BRANDING_COLOR_TOKEN_KEYS[themeKey];
    const cssVar = `${UI_CONTENT_THEME_CSS_VAR_PREFIX}${canonicalKey}`;
    if (!value.tokens[canonicalKey]) {
      return { ok: false, message: `Provider tokens missing ${canonicalKey}.` };
    }
    if (!value.selectorMatrix.primary.background) {
      return { ok: false, message: "Provider selectorMatrix must expose primary background." };
    }
    void cssVar;
  }

  const markup = renderToStaticMarkup(
    createElement(
      BrandingUiProvider,
      { organizationBranding: createDefaultBranding() },
      createElement("span", null, "parity")
    )
  );

  if (!markup.includes("data-peaker-ui-content-root")) {
    return { ok: false, message: "BrandingUiProvider must render data-peaker-ui-content-root." };
  }

  for (const themeKey of BRANDING_COLOR_TOKEN_KEY_LIST) {
    const canonicalKey = BRANDING_COLOR_TOKEN_KEYS[themeKey];
    const cssVar = `${UI_CONTENT_THEME_CSS_VAR_PREFIX}${canonicalKey}`;
    if (!markup.includes(cssVar)) {
      return { ok: false, message: `BrandingUiProvider markup missing ${cssVar}.` };
    }
  }

  return { ok: true };
}

describe("brandingProviderContract", () => {
  it("exposes required context fields for default branding", () => {
    expect(runBrandingProviderContractParityGate().ok).toBe(true);
  });

  it("falls back to default branding for invalid snapshot input", () => {
    const value = createBrandingUiContextValue({ organizationBranding: { invalid: true } });
    expect(value.organizationBranding.theme.primary).toBe("#7c3aed");
    expect(value.selectorMatrix.primary.background).toBe("#7c3aed");
  });

  it("reflects custom branding revision in context value", () => {
    const branding = mergeBranding(createDefaultBranding(), {
      brandingRevision: 7,
      theme: {
        ...createDefaultBranding().theme,
        primary: "#112233",
      },
    });
    const value = createBrandingUiContextValue({ organizationBranding: branding });
    expect(value.brandingRevision).toBe(7);
    expect(value.selectorMatrix.primary.background).toBe("#112233");
  });
});
