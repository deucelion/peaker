import {
  BRANDING_COLOR_TOKEN_KEY_LIST,
  BRANDING_COLOR_TOKEN_KEYS,
} from "@/lib/organization/branding/tokens";
import type { BrandingTheme } from "@/lib/organization/branding/types";

export const LAYOUT_THEME_CSS_VAR_PREFIX = "--peaker-layout-theme" as const;

export type LayoutThemeTokenSnapshot = {
  [K in (typeof BRANDING_COLOR_TOKEN_KEYS)[keyof typeof BRANDING_COLOR_TOKEN_KEYS]]: string;
};

export const LAYOUT_THEME_VARS = {
  PRIMARY: `var(${LAYOUT_THEME_CSS_VAR_PREFIX}-PRIMARY)`,
  SECONDARY: `var(${LAYOUT_THEME_CSS_VAR_PREFIX}-SECONDARY)`,
  ACCENT: `var(${LAYOUT_THEME_CSS_VAR_PREFIX}-ACCENT)`,
  BACKGROUND: `var(${LAYOUT_THEME_CSS_VAR_PREFIX}-BACKGROUND)`,
  SURFACE: `var(${LAYOUT_THEME_CSS_VAR_PREFIX}-SURFACE)`,
  TEXT_PRIMARY: `var(${LAYOUT_THEME_CSS_VAR_PREFIX}-TEXT_PRIMARY)`,
  TEXT_SECONDARY: `var(${LAYOUT_THEME_CSS_VAR_PREFIX}-TEXT_SECONDARY)`,
  SIDEBAR_BACKGROUND: `var(${LAYOUT_THEME_CSS_VAR_PREFIX}-SIDEBAR_BACKGROUND)`,
  SIDEBAR_TEXT: `var(${LAYOUT_THEME_CSS_VAR_PREFIX}-SIDEBAR_TEXT)`,
  SIDEBAR_ACTIVE: `var(${LAYOUT_THEME_CSS_VAR_PREFIX}-SIDEBAR_ACTIVE)`,
} as const satisfies LayoutThemeTokenSnapshot;

/** Yalnizca canonical theme token'larini okur. */
export function extractLayoutThemeTokens(theme: BrandingTheme): LayoutThemeTokenSnapshot {
  const snapshot = {} as LayoutThemeTokenSnapshot;
  for (const key of BRANDING_COLOR_TOKEN_KEY_LIST) {
    snapshot[BRANDING_COLOR_TOKEN_KEYS[key]] = theme[key];
  }
  return snapshot;
}

export function buildLayoutThemeCssVariables(
  tokens: LayoutThemeTokenSnapshot
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const canonicalKey of Object.values(BRANDING_COLOR_TOKEN_KEYS)) {
    vars[`${LAYOUT_THEME_CSS_VAR_PREFIX}-${canonicalKey}`] = tokens[canonicalKey];
  }
  return vars;
}

export function createLayoutThemeStyle(theme: BrandingTheme): Record<string, string> {
  return buildLayoutThemeCssVariables(extractLayoutThemeTokens(theme));
}

/** Default Peaker layout renkleri ile canonical token parity kontrolu. */
export function isDefaultLayoutThemeParity(tokens: LayoutThemeTokenSnapshot): boolean {
  return (
    tokens.PRIMARY === "#7c3aed" &&
    tokens.BACKGROUND === "#09090b" &&
    tokens.SURFACE === "#121215"
  );
}
