import { UI_CONTENT_THEME_VARS } from "./UI_CONTENT_THEME_VARS";

/** Empty/loading/KPI shell references — content theme tokens only (Wave 13). */
export const emptyLoadingSelectors = {
  surface: UI_CONTENT_THEME_VARS.SURFACE,
  textPrimary: UI_CONTENT_THEME_VARS.TEXT_PRIMARY,
  textSecondary: UI_CONTENT_THEME_VARS.TEXT_SECONDARY,
  primary: UI_CONTENT_THEME_VARS.PRIMARY,
  border: "rgba(255,255,255,0.1)",
} as const;

export function loadingSpinnerColor(): string {
  return UI_CONTENT_THEME_VARS.PRIMARY;
}

export function skeletonPulseBackground(): string {
  return `color-mix(in srgb, ${UI_CONTENT_THEME_VARS.TEXT_PRIMARY} 4%, transparent)`;
}

export function skeletonLineBackground(): string {
  return `color-mix(in srgb, ${UI_CONTENT_THEME_VARS.TEXT_PRIMARY} 6%, transparent)`;
}
