import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import { parseOrganizationBranding } from "@/lib/organization/branding/parser";
import { BRANDING_COLOR_TOKEN_KEY_LIST, BRANDING_COLOR_TOKEN_KEYS } from "@/lib/organization/branding/tokens";
import type { BrandingColorTokenKey, OrganizationBranding } from "@/lib/organization/branding/types";
import {
  extractContentThemeTokens,
  isDefaultContentThemeParity,
  type UiContentThemeTokenSnapshot,
  UI_CONTENT_THEME_VARS,
} from "./UI_CONTENT_THEME_VARS";

export function resolveOrganizationBrandingSnapshot(
  snapshot: OrganizationBranding | null | undefined | unknown
): OrganizationBranding {
  return parseOrganizationBranding(snapshot).branding;
}

export function resolveContentThemeTokens(
  branding: OrganizationBranding | null | undefined | unknown
): UiContentThemeTokenSnapshot {
  const resolved = resolveOrganizationBrandingSnapshot(branding);
  return extractContentThemeTokens(resolved.theme);
}

export { isDefaultContentThemeParity };

export function mixPrimary(opacityPercent: number): string {
  return `color-mix(in srgb, ${UI_CONTENT_THEME_VARS.PRIMARY} ${opacityPercent}%, transparent)`;
}

export function mixSurfaceWithBackground(surfacePercent: number): string {
  return `color-mix(in srgb, ${UI_CONTENT_THEME_VARS.SURFACE} ${surfacePercent}%, ${UI_CONTENT_THEME_VARS.BACKGROUND})`;
}

export function focusRingBorder(): string {
  return `color-mix(in srgb, ${UI_CONTENT_THEME_VARS.PRIMARY} 60%, transparent)`;
}

export function mixResolvedColor(base: string, blend: string, basePercent: number): string {
  return `color-mix(in srgb, ${base} ${basePercent}%, ${blend})`;
}

const CANONICAL_TO_THEME_KEY = Object.fromEntries(
  BRANDING_COLOR_TOKEN_KEY_LIST.map((themeKey) => [BRANDING_COLOR_TOKEN_KEYS[themeKey], themeKey])
) as Record<keyof UiContentThemeTokenSnapshot, BrandingColorTokenKey>;

export function readThemeTokenOrDefault(
  tokens: UiContentThemeTokenSnapshot,
  key: keyof UiContentThemeTokenSnapshot
): string {
  const value = tokens[key];
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return createDefaultBranding().theme[CANONICAL_TO_THEME_KEY[key]];
}
