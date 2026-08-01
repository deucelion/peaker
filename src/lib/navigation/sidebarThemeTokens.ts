import { BRANDING_COLOR_TOKEN_KEYS } from "@/lib/organization/branding/tokens";
import type { BrandingSidebar, BrandingTheme, OrganizationBranding } from "@/lib/organization/branding/types";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import { resolveSidebarBranding } from "@/lib/organization/branding/surfaces/resolveSidebarBranding";

export const SIDEBAR_THEME_CSS_VAR_PREFIX = "--peaker-sidebar-theme" as const;

/** Sidebar render icin izin verilen canonical token anahtarlari. */
export const SIDEBAR_THEME_TOKEN_KEYS = [
  BRANDING_COLOR_TOKEN_KEYS.sidebarBackground,
  BRANDING_COLOR_TOKEN_KEYS.sidebarText,
  BRANDING_COLOR_TOKEN_KEYS.sidebarActive,
  BRANDING_COLOR_TOKEN_KEYS.textPrimary,
  BRANDING_COLOR_TOKEN_KEYS.textSecondary,
  BRANDING_COLOR_TOKEN_KEYS.primary,
  BRANDING_COLOR_TOKEN_KEYS.background,
  BRANDING_COLOR_TOKEN_KEYS.surface,
] as const;

export type SidebarThemeTokenKey = (typeof SIDEBAR_THEME_TOKEN_KEYS)[number];

export type SidebarThemeTokenSnapshot = Record<SidebarThemeTokenKey, string>;

export const SIDEBAR_THEME_VARS = {
  SIDEBAR_BACKGROUND: `var(${SIDEBAR_THEME_CSS_VAR_PREFIX}-SIDEBAR_BACKGROUND)`,
  SIDEBAR_TEXT: `var(${SIDEBAR_THEME_CSS_VAR_PREFIX}-SIDEBAR_TEXT)`,
  SIDEBAR_ACTIVE: `var(${SIDEBAR_THEME_CSS_VAR_PREFIX}-SIDEBAR_ACTIVE)`,
  TEXT_PRIMARY: `var(${SIDEBAR_THEME_CSS_VAR_PREFIX}-TEXT_PRIMARY)`,
  TEXT_SECONDARY: `var(${SIDEBAR_THEME_CSS_VAR_PREFIX}-TEXT_SECONDARY)`,
  PRIMARY: `var(${SIDEBAR_THEME_CSS_VAR_PREFIX}-PRIMARY)`,
  BACKGROUND: `var(${SIDEBAR_THEME_CSS_VAR_PREFIX}-BACKGROUND)`,
  SURFACE: `var(${SIDEBAR_THEME_CSS_VAR_PREFIX}-SURFACE)`,
} as const satisfies SidebarThemeTokenSnapshot;

function readThemeToken(theme: BrandingTheme, key: keyof BrandingTheme): string {
  const value = theme[key];
  return typeof value === "string" && value.length > 0 ? value : createDefaultBranding().theme[key];
}

/** Yalnizca sidebar section + allowlist theme token'larini okur. */
export function extractSidebarThemeTokens(
  sidebar: BrandingSidebar,
  theme: BrandingTheme
): SidebarThemeTokenSnapshot {
  const defaults = createDefaultBranding();
  const safeTheme = theme ?? defaults.theme;
  const safeSidebar = sidebar ?? defaults.sidebar;

  return {
    [BRANDING_COLOR_TOKEN_KEYS.sidebarBackground]: safeSidebar.background,
    [BRANDING_COLOR_TOKEN_KEYS.sidebarText]: safeSidebar.text,
    [BRANDING_COLOR_TOKEN_KEYS.sidebarActive]: safeSidebar.active,
    [BRANDING_COLOR_TOKEN_KEYS.textPrimary]: readThemeToken(safeTheme, "textPrimary"),
    [BRANDING_COLOR_TOKEN_KEYS.textSecondary]: readThemeToken(safeTheme, "textSecondary"),
    [BRANDING_COLOR_TOKEN_KEYS.primary]: readThemeToken(safeTheme, "primary"),
    [BRANDING_COLOR_TOKEN_KEYS.background]: readThemeToken(safeTheme, "background"),
    [BRANDING_COLOR_TOKEN_KEYS.surface]: readThemeToken(safeTheme, "surface"),
  };
}

export function buildSidebarThemeCssVariables(
  tokens: SidebarThemeTokenSnapshot
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const canonicalKey of SIDEBAR_THEME_TOKEN_KEYS) {
    vars[`${SIDEBAR_THEME_CSS_VAR_PREFIX}-${canonicalKey}`] = tokens[canonicalKey];
  }
  return vars;
}

export function createSidebarThemeStyle(
  sidebar: BrandingSidebar,
  theme: BrandingTheme
): Record<string, string> {
  return buildSidebarThemeCssVariables(extractSidebarThemeTokens(sidebar, theme));
}

export function createSidebarThemeStyleFromBranding(
  organizationBranding: OrganizationBranding | null | undefined
): Record<string, string> {
  const branding = organizationBranding ?? createDefaultBranding();
  const resolved = resolveSidebarBranding(branding);
  return createSidebarThemeStyle(resolved.sidebar, branding.theme);
}

export function isDefaultSidebarThemeParity(tokens: SidebarThemeTokenSnapshot): boolean {
  const defaults = createDefaultBranding();
  const expected = extractSidebarThemeTokens(defaults.sidebar, defaults.theme);
  return SIDEBAR_THEME_TOKEN_KEYS.every((key) => tokens[key] === expected[key]);
}

export function buildSidebarNavItemStyle(input: {
  active: boolean;
  variant: "default" | "highlight";
}): Record<string, string | number> {
  if (input.variant === "highlight") {
    return input.active
      ? {
          backgroundColor: SIDEBAR_THEME_VARS.PRIMARY,
          color: SIDEBAR_THEME_VARS.TEXT_PRIMARY,
          boxShadow: `0 10px 15px -3px color-mix(in srgb, ${SIDEBAR_THEME_VARS.PRIMARY} 20%, transparent)`,
        }
      : {
          backgroundColor: `color-mix(in srgb, ${SIDEBAR_THEME_VARS.PRIMARY} 5%, transparent)`,
          color: SIDEBAR_THEME_VARS.PRIMARY,
          borderColor: `color-mix(in srgb, ${SIDEBAR_THEME_VARS.PRIMARY} 10%, transparent)`,
        };
  }

  return input.active
    ? {
        backgroundColor: `color-mix(in srgb, ${SIDEBAR_THEME_VARS.PRIMARY} 10%, transparent)`,
        color: SIDEBAR_THEME_VARS.SIDEBAR_ACTIVE,
        borderColor: "rgba(255,255,255,0.05)",
      }
    : {
        color: SIDEBAR_THEME_VARS.SIDEBAR_TEXT,
      };
}

export function buildSidebarNavIconStyle(input: {
  active: boolean;
  variant: "default" | "highlight";
}): Record<string, string> {
  if (input.variant === "highlight") {
    return { color: input.active ? SIDEBAR_THEME_VARS.TEXT_PRIMARY : SIDEBAR_THEME_VARS.PRIMARY };
  }

  return {
    color: input.active ? SIDEBAR_THEME_VARS.PRIMARY : SIDEBAR_THEME_VARS.SIDEBAR_TEXT,
  };
}
