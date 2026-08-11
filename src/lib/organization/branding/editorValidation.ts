import type { BrandingSidebar, BrandingTheme } from "./types";
import { BRANDING_COLOR_TOKEN_KEY_LIST } from "./tokens";
import { validateBrandingSidebarTokens, validateBrandingTokens } from "./validation";

export type ThemeEditorFieldErrors = Partial<Record<keyof BrandingTheme, string>>;

export function buildSidebarFromTheme(theme: BrandingTheme): BrandingSidebar {
  return {
    background: theme.sidebarBackground,
    text: theme.sidebarText,
    active: theme.sidebarActive,
  };
}

export function mapThemeValidationErrors(theme: BrandingTheme): ThemeEditorFieldErrors {
  const fieldErrors: ThemeEditorFieldErrors = {};
  const tokenValidation = validateBrandingTokens(theme);
  if (tokenValidation.ok) {
    return fieldErrors;
  }

  for (const message of tokenValidation.errors) {
    for (const key of BRANDING_COLOR_TOKEN_KEY_LIST) {
      if (message.includes(key)) {
        fieldErrors[key] = message;
      }
    }
  }

  if (Object.keys(fieldErrors).length === 0 && tokenValidation.errors.length > 0) {
    fieldErrors.primary = tokenValidation.errors.join(" ");
  }

  return fieldErrors;
}

export function validateThemeEditorInput(theme: BrandingTheme):
  | { ok: true }
  | { ok: false; error: string; fieldErrors: ThemeEditorFieldErrors } {
  const fieldErrors = mapThemeValidationErrors(theme);
  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      error: "Branding renkleri gecersiz.",
      fieldErrors,
    };
  }

  const sidebarValidation = validateBrandingSidebarTokens(buildSidebarFromTheme(theme));
  if (!sidebarValidation.ok) {
    return {
      ok: false,
      error: sidebarValidation.errors.join(" "),
      fieldErrors: {
        sidebarBackground:
          sidebarValidation.errors.find((entry) => entry.includes("background")) ??
          sidebarValidation.errors[0],
        sidebarText: sidebarValidation.errors.find((entry) => entry.includes("text")),
        sidebarActive: sidebarValidation.errors.find((entry) => entry.includes("active")),
      },
    };
  }

  return { ok: true };
}

export const THEME_TOKEN_LABELS: Record<keyof BrandingTheme, string> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  background: "Background",
  surface: "Surface",
  textPrimary: "Text Primary",
  textSecondary: "Text Secondary",
  sidebarBackground: "Sidebar Background",
  sidebarText: "Sidebar Text",
  sidebarActive: "Sidebar Active",
};

export const THEME_TOKEN_GROUPS = {
  content: ["primary", "secondary", "accent", "background", "surface", "textPrimary", "textSecondary"],
  sidebar: ["sidebarBackground", "sidebarText", "sidebarActive"],
} as const satisfies {
  content: readonly (keyof BrandingTheme)[];
  sidebar: readonly (keyof BrandingTheme)[];
};
