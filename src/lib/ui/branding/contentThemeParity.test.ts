import { describe, expect, it } from "vitest";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import { mergeBranding } from "@/lib/organization/branding/helpers";
import {
  extractContentThemeTokens,
  isDefaultContentThemeParity,
  type UiContentThemeTokenSnapshot,
} from "./UI_CONTENT_THEME_VARS";

export const DEFAULT_CONTENT_THEME_PARITY_TOKENS: UiContentThemeTokenSnapshot = {
  PRIMARY: "#7c3aed",
  SECONDARY: "#5b21b6",
  ACCENT: "#7c3aed",
  BACKGROUND: "#09090b",
  SURFACE: "#121215",
  TEXT_PRIMARY: "#ffffff",
  TEXT_SECONDARY: "#a1a1aa",
  SIDEBAR_BACKGROUND: "#09090b",
  SIDEBAR_TEXT: "#71717a",
  SIDEBAR_ACTIVE: "#ffffff",
};

/** CI parity gate: default Peaker content tokens match canonical defaults. */
export function runDefaultContentThemeParityGate():
  | { ok: true }
  | { ok: false; message: string } {
  const tokens = extractContentThemeTokens(createDefaultBranding().theme);
  if (!isDefaultContentThemeParity(tokens)) {
    return {
      ok: false,
      message: "Default content theme parity failed for PRIMARY/BACKGROUND/SURFACE.",
    };
  }

  for (const [key, expected] of Object.entries(DEFAULT_CONTENT_THEME_PARITY_TOKENS)) {
    const actual = tokens[key as keyof UiContentThemeTokenSnapshot];
    if (actual !== expected) {
      return {
        ok: false,
        message: `Content token ${key} expected ${expected} but got ${actual}.`,
      };
    }
  }

  return { ok: true };
}

describe("contentThemeParity", () => {
  it("preserves default Peaker content theme parity", () => {
    expect(runDefaultContentThemeParityGate().ok).toBe(true);
  });

  it("detects custom branding divergence from default content parity", () => {
    const tokens = extractContentThemeTokens(
      mergeBranding(createDefaultBranding(), {
        theme: {
          ...createDefaultBranding().theme,
          primary: "#112233",
        },
      }).theme
    );
    expect(isDefaultContentThemeParity(tokens)).toBe(false);
  });

  it("maps every default branding theme field into content tokens", () => {
    const tokens = extractContentThemeTokens(createDefaultBranding().theme);
    expect(tokens).toEqual(DEFAULT_CONTENT_THEME_PARITY_TOKENS);
  });
});
