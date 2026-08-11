import {
  BRANDING_COLOR_TOKEN_KEY_LIST,
  BRANDING_COLOR_TOKEN_KEYS,
} from "@/lib/organization/branding/tokens";
import type { BrandingTheme } from "@/lib/organization/branding/types";

export const UI_CONTENT_THEME_CSS_VAR_PREFIX = "--peaker-ui-" as const;

export type UiContentThemeTokenSnapshot = {
  [K in (typeof BRANDING_COLOR_TOKEN_KEYS)[keyof typeof BRANDING_COLOR_TOKEN_KEYS]]: string;
};

export const UI_CONTENT_THEME_VARS = {
  PRIMARY: `var(${UI_CONTENT_THEME_CSS_VAR_PREFIX}PRIMARY)`,
  SECONDARY: `var(${UI_CONTENT_THEME_CSS_VAR_PREFIX}SECONDARY)`,
  ACCENT: `var(${UI_CONTENT_THEME_CSS_VAR_PREFIX}ACCENT)`,
  BACKGROUND: `var(${UI_CONTENT_THEME_CSS_VAR_PREFIX}BACKGROUND)`,
  SURFACE: `var(${UI_CONTENT_THEME_CSS_VAR_PREFIX}SURFACE)`,
  TEXT_PRIMARY: `var(${UI_CONTENT_THEME_CSS_VAR_PREFIX}TEXT_PRIMARY)`,
  TEXT_SECONDARY: `var(${UI_CONTENT_THEME_CSS_VAR_PREFIX}TEXT_SECONDARY)`,
  SIDEBAR_BACKGROUND: `var(${UI_CONTENT_THEME_CSS_VAR_PREFIX}SIDEBAR_BACKGROUND)`,
  SIDEBAR_TEXT: `var(${UI_CONTENT_THEME_CSS_VAR_PREFIX}SIDEBAR_TEXT)`,
  SIDEBAR_ACTIVE: `var(${UI_CONTENT_THEME_CSS_VAR_PREFIX}SIDEBAR_ACTIVE)`,
} as const satisfies UiContentThemeTokenSnapshot;

/** Yalnizca canonical theme token'larini okur. */
export function extractContentThemeTokens(theme: BrandingTheme): UiContentThemeTokenSnapshot {
  const snapshot = {} as UiContentThemeTokenSnapshot;
  for (const key of BRANDING_COLOR_TOKEN_KEY_LIST) {
    snapshot[BRANDING_COLOR_TOKEN_KEYS[key]] = theme[key];
  }
  return snapshot;
}

export function buildContentThemeCssVariables(
  tokens: UiContentThemeTokenSnapshot
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const canonicalKey of Object.values(BRANDING_COLOR_TOKEN_KEYS)) {
    vars[`${UI_CONTENT_THEME_CSS_VAR_PREFIX}${canonicalKey}`] = tokens[canonicalKey];
  }
  return vars;
}

export function createContentThemeStyle(theme: BrandingTheme): Record<string, string> {
  return buildContentThemeCssVariables(extractContentThemeTokens(theme));
}

/** Default Peaker content renkleri ile canonical token parity kontrolu. */
export function isDefaultContentThemeParity(tokens: UiContentThemeTokenSnapshot): boolean {
  return (
    tokens.PRIMARY === "#7c3aed" &&
    tokens.BACKGROUND === "#09090b" &&
    tokens.SURFACE === "#121215"
  );
}
