import type { UiContentThemeTokenSnapshot } from "./UI_CONTENT_THEME_VARS";
import { UI_CONTENT_THEME_VARS } from "./UI_CONTENT_THEME_VARS";
import { mixResolvedColor, readThemeTokenOrDefault } from "./uiBrandingHelpers";

export type UiBrandingSelectorMatrix = {
  readonly surface: {
    readonly background: string;
    readonly elevated: string;
  };
  readonly primary: {
    readonly background: string;
    readonly foreground: string;
    readonly hover: string;
  };
  readonly border: {
    readonly default: string;
    readonly focus: string;
    readonly muted: string;
  };
  readonly text: {
    readonly primary: string;
    readonly secondary: string;
    readonly onPrimary: string;
  };
};

/** CSS var tabanli content selector referanslari — component tüketimi icin. */
export const uiBrandingSelectors = {
  surface: {
    background: UI_CONTENT_THEME_VARS.SURFACE,
    elevated: `color-mix(in srgb, ${UI_CONTENT_THEME_VARS.SURFACE} 80%, ${UI_CONTENT_THEME_VARS.BACKGROUND})`,
  },
  primary: {
    background: UI_CONTENT_THEME_VARS.PRIMARY,
    foreground: UI_CONTENT_THEME_VARS.TEXT_PRIMARY,
    hover: `color-mix(in srgb, ${UI_CONTENT_THEME_VARS.PRIMARY} 90%, black)`,
  },
  border: {
    default: "rgba(255,255,255,0.05)",
    focus: `color-mix(in srgb, ${UI_CONTENT_THEME_VARS.PRIMARY} 60%, transparent)`,
    muted: `color-mix(in srgb, ${UI_CONTENT_THEME_VARS.TEXT_SECONDARY} 20%, transparent)`,
  },
  text: {
    primary: UI_CONTENT_THEME_VARS.TEXT_PRIMARY,
    secondary: UI_CONTENT_THEME_VARS.TEXT_SECONDARY,
    onPrimary: UI_CONTENT_THEME_VARS.TEXT_PRIMARY,
  },
} as const;

export function buildUiBrandingSelectorMatrix(
  tokens: UiContentThemeTokenSnapshot
): UiBrandingSelectorMatrix {
  const surface = readThemeTokenOrDefault(tokens, "SURFACE");
  const background = readThemeTokenOrDefault(tokens, "BACKGROUND");
  const primary = readThemeTokenOrDefault(tokens, "PRIMARY");
  const textPrimary = readThemeTokenOrDefault(tokens, "TEXT_PRIMARY");
  const textSecondary = readThemeTokenOrDefault(tokens, "TEXT_SECONDARY");

  return {
    surface: {
      background: surface,
      elevated: mixResolvedColor(surface, background, 80),
    },
    primary: {
      background: primary,
      foreground: textPrimary,
      hover: mixResolvedColor(primary, "#000000", 90),
    },
    border: {
      default: "rgba(255,255,255,0.05)",
      focus: mixResolvedColor(primary, "transparent", 60),
      muted: mixResolvedColor(textSecondary, "transparent", 20),
    },
    text: {
      primary: textPrimary,
      secondary: textSecondary,
      onPrimary: textPrimary,
    },
  };
}
