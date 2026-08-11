import { UI_CONTENT_THEME_VARS } from "@/lib/ui/branding/UI_CONTENT_THEME_VARS";

/** Overlay-specific selector references — content namespace only. */
export const overlaySelectors = {
  backdrop: {
    scrim: `color-mix(in srgb, ${UI_CONTENT_THEME_VARS.BACKGROUND} 70%, transparent)`,
    scrimStrong: `color-mix(in srgb, ${UI_CONTENT_THEME_VARS.BACKGROUND} 75%, transparent)`,
  },
  surface: {
    panel: UI_CONTENT_THEME_VARS.SURFACE,
    elevated: `color-mix(in srgb, ${UI_CONTENT_THEME_VARS.SURFACE} 95%, ${UI_CONTENT_THEME_VARS.BACKGROUND})`,
  },
  border: {
    default: "rgba(255,255,255,0.1)",
    muted: `color-mix(in srgb, ${UI_CONTENT_THEME_VARS.TEXT_SECONDARY} 15%, transparent)`,
    focus: `color-mix(in srgb, ${UI_CONTENT_THEME_VARS.PRIMARY} 40%, transparent)`,
  },
  text: {
    primary: UI_CONTENT_THEME_VARS.TEXT_PRIMARY,
    secondary: UI_CONTENT_THEME_VARS.TEXT_SECONDARY,
  },
  shadow: {
    panel: "0 25px 50px -12px color-mix(in srgb, var(--peaker-ui-BACKGROUND) 65%, transparent)",
  },
} as const;

export type OverlaySelectorMap = typeof overlaySelectors;

export function overlayPanelStyle(): Record<string, string> {
  return {
    backgroundColor: "var(--peaker-ui-SURFACE)",
    color: "var(--peaker-ui-TEXT_PRIMARY)",
    borderColor: overlaySelectors.border.default,
  };
}

export function overlayBackdropStyle(strong = false): Record<string, string> {
  return {
    backgroundColor: strong ? overlaySelectors.backdrop.scrimStrong : overlaySelectors.backdrop.scrim,
  };
}
