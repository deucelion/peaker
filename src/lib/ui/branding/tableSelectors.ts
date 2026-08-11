import { UI_CONTENT_THEME_VARS } from "./UI_CONTENT_THEME_VARS";

/** Table shell style references — content theme tokens only (Wave 11). */
export function tableShellStyle(): Record<string, string> {
  return {
    backgroundColor: UI_CONTENT_THEME_VARS.SURFACE,
    color: UI_CONTENT_THEME_VARS.TEXT_PRIMARY,
    borderColor: "rgba(255,255,255,0.1)",
  };
}

export function tableHeadStyle(): Record<string, string> {
  return {
    backgroundColor: `color-mix(in srgb, ${UI_CONTENT_THEME_VARS.SURFACE} 92%, ${UI_CONTENT_THEME_VARS.TEXT_PRIMARY} 8%)`,
    color: UI_CONTENT_THEME_VARS.TEXT_SECONDARY,
  };
}

export function tableRowHoverStyle(): Record<string, string> {
  return {
    backgroundColor: `color-mix(in srgb, ${UI_CONTENT_THEME_VARS.PRIMARY} 6%, transparent)`,
  };
}

export const tableSelectors = {
  surface: UI_CONTENT_THEME_VARS.SURFACE,
  textPrimary: UI_CONTENT_THEME_VARS.TEXT_PRIMARY,
  textSecondary: UI_CONTENT_THEME_VARS.TEXT_SECONDARY,
  primary: UI_CONTENT_THEME_VARS.PRIMARY,
  border: "rgba(255,255,255,0.1)",
} as const;
