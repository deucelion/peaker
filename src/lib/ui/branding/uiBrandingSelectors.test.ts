import { describe, expect, it } from "vitest";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import { mergeBranding } from "@/lib/organization/branding/helpers";
import { extractContentThemeTokens } from "./UI_CONTENT_THEME_VARS";
import { buildUiBrandingSelectorMatrix, uiBrandingSelectors } from "./uiBrandingSelectors";

export const DEFAULT_SELECTOR_MATRIX_SNAPSHOT = {
  surface: {
    background: "#121215",
    elevated: "color-mix(in srgb, #121215 80%, #09090b)",
  },
  primary: {
    background: "#7c3aed",
    foreground: "#ffffff",
    hover: "color-mix(in srgb, #7c3aed 90%, #000000)",
  },
  border: {
    default: "rgba(255,255,255,0.05)",
    focus: "color-mix(in srgb, #7c3aed 60%, transparent)",
    muted: "color-mix(in srgb, #a1a1aa 20%, transparent)",
  },
  text: {
    primary: "#ffffff",
    secondary: "#a1a1aa",
    onPrimary: "#ffffff",
  },
} as const;

/** CI parity gate: default selector matrix matches canonical snapshot. */
export function runDefaultSelectorMatrixParityGate():
  | { ok: true }
  | { ok: false; message: string } {
  const tokens = extractContentThemeTokens(createDefaultBranding().theme);
  const matrix = buildUiBrandingSelectorMatrix(tokens);
  if (JSON.stringify(matrix) !== JSON.stringify(DEFAULT_SELECTOR_MATRIX_SNAPSHOT)) {
    return { ok: false, message: "Default selector matrix snapshot mismatch." };
  }
  return { ok: true };
}

describe("uiBrandingSelectors", () => {
  it("exposes CSS var references for core surface, primary, border, and text selectors", () => {
    expect(uiBrandingSelectors.surface.background).toBe("var(--peaker-ui-SURFACE)");
    expect(uiBrandingSelectors.primary.background).toBe("var(--peaker-ui-PRIMARY)");
    expect(uiBrandingSelectors.border.focus).toContain("var(--peaker-ui-PRIMARY)");
    expect(uiBrandingSelectors.text.secondary).toBe("var(--peaker-ui-TEXT_SECONDARY)");
  });

  it("matches default branding selector matrix snapshot", () => {
    expect(runDefaultSelectorMatrixParityGate().ok).toBe(true);
  });

  it("reflects custom primary color in selector matrix output", () => {
    const branding = mergeBranding(createDefaultBranding(), {
      theme: {
        ...createDefaultBranding().theme,
        primary: "#112233",
      },
    });

    const matrix = buildUiBrandingSelectorMatrix(extractContentThemeTokens(branding.theme));
    expect(matrix.primary.background).toBe("#112233");
    expect(matrix.border.focus).toBe("color-mix(in srgb, #112233 60%, transparent)");
  });

  it("falls back to default tokens for invalid partial theme values", () => {
    const tokens = extractContentThemeTokens(createDefaultBranding().theme);
    const matrix = buildUiBrandingSelectorMatrix({
      ...tokens,
      PRIMARY: "",
      TEXT_SECONDARY: "",
    });

    expect(matrix.primary.background).toBe("#7c3aed");
    expect(matrix.text.secondary).toBe("#a1a1aa");
  });
});
