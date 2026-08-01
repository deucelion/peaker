import { describe, expect, it } from "vitest";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import { mergeBranding } from "@/lib/organization/branding/helpers";
import { BRANDING_COLOR_TOKEN_KEYS } from "@/lib/organization/branding/tokens";
import {
  buildLayoutThemeCssVariables,
  createLayoutThemeStyle,
  extractLayoutThemeTokens,
  isDefaultLayoutThemeParity,
  LAYOUT_THEME_CSS_VAR_PREFIX,
  LAYOUT_THEME_VARS,
} from "./layoutThemeTokens";

describe("layoutThemeTokens", () => {
  it("maps canonical theme tokens from branding theme snapshot", () => {
    const theme = mergeBranding(createDefaultBranding(), {
      theme: {
        ...createDefaultBranding().theme,
        primary: "#aabbcc",
        textSecondary: "#cccddd",
      },
    }).theme;

    const tokens = extractLayoutThemeTokens(theme);
    expect(tokens.PRIMARY).toBe("#aabbcc");
    expect(tokens.TEXT_SECONDARY).toBe("#cccddd");
    expect(tokens.BACKGROUND).toBe(theme.background);
  });

  it("reads only canonical theme token keys", () => {
    const tokens = extractLayoutThemeTokens(createDefaultBranding().theme);
    expect(Object.keys(tokens).sort()).toEqual(Object.values(BRANDING_COLOR_TOKEN_KEYS).sort());
  });

  it("builds css variables with canonical token names", () => {
    const tokens = extractLayoutThemeTokens(createDefaultBranding().theme);
    const cssVars = buildLayoutThemeCssVariables(tokens);
    expect(cssVars[`${LAYOUT_THEME_CSS_VAR_PREFIX}-PRIMARY`]).toBe("#7c3aed");
    expect(cssVars[`${LAYOUT_THEME_CSS_VAR_PREFIX}-BACKGROUND`]).toBe("#09090b");
    expect(cssVars[`${LAYOUT_THEME_CSS_VAR_PREFIX}-SURFACE`]).toBe("#121215");
  });

  it("creates layout theme style from branding theme", () => {
    const style = createLayoutThemeStyle(createDefaultBranding().theme);
    expect(style[`${LAYOUT_THEME_CSS_VAR_PREFIX}-ACCENT`]).toBe("#7c3aed");
  });

  it("exposes layout theme var references without magic strings", () => {
    expect(LAYOUT_THEME_VARS.PRIMARY).toBe("var(--peaker-layout-theme-PRIMARY)");
    expect(LAYOUT_THEME_VARS.BACKGROUND).toBe("var(--peaker-layout-theme-BACKGROUND)");
  });

  it("preserves default layout parity for Peaker branding", () => {
    const tokens = extractLayoutThemeTokens(createDefaultBranding().theme);
    expect(isDefaultLayoutThemeParity(tokens)).toBe(true);
  });

  it("detects runtime branding divergence from default layout parity", () => {
    const tokens = extractLayoutThemeTokens(
      mergeBranding(createDefaultBranding(), {
        theme: {
          ...createDefaultBranding().theme,
          primary: "#ffffff",
        },
      }).theme
    );
    expect(isDefaultLayoutThemeParity(tokens)).toBe(false);
  });
});

describe("layout branding snapshot integration", () => {
  it("maps me-access organizationBranding snapshot to layout theme tokens", async () => {
    const { resolveLayoutBranding } = await import(
      "@/lib/organization/branding/surfaces/resolveLayoutBranding"
    );

    const branding = mergeBranding(createDefaultBranding(), {
      theme: {
        ...createDefaultBranding().theme,
        surface: "#222222",
      },
      brandingRevision: 3,
    });

    const layoutSnapshot = resolveLayoutBranding(branding);
    const tokens = extractLayoutThemeTokens(layoutSnapshot.theme);
    expect(tokens.SURFACE).toBe("#222222");
    expect(layoutSnapshot.brandingRevision).toBe(3);
  });
});
