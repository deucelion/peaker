import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import {
  BRANDING_COLOR_TOKEN_KEYS,
  BRANDING_COLOR_TOKEN_KEY_LIST,
} from "@/lib/organization/branding/tokens";
import {
  UI_CONTENT_THEME_CSS_VAR_PREFIX,
  UI_CONTENT_THEME_VARS,
  buildContentThemeCssVariables,
  extractContentThemeTokens,
} from "./UI_CONTENT_THEME_VARS";

describe("UI_CONTENT_THEME_VARS contract", () => {
  it("maps every canonical color token key to a content CSS variable reference", () => {
    for (const themeKey of BRANDING_COLOR_TOKEN_KEY_LIST) {
      const canonicalKey = BRANDING_COLOR_TOKEN_KEYS[themeKey];
      expect(UI_CONTENT_THEME_VARS[canonicalKey]).toBe(
        `var(${UI_CONTENT_THEME_CSS_VAR_PREFIX}${canonicalKey})`
      );
    }
  });

  it("exposes exactly one CSS variable per canonical color token key", () => {
    expect(Object.keys(UI_CONTENT_THEME_VARS).sort()).toEqual(
      Object.values(BRANDING_COLOR_TOKEN_KEYS).sort()
    );
  });

  it("builds one CSS custom property per canonical token", () => {
    const tokens = extractContentThemeTokens(createDefaultBranding().theme);
    const cssVars = buildContentThemeCssVariables(tokens);

    expect(Object.keys(cssVars).sort()).toEqual(
      Object.values(BRANDING_COLOR_TOKEN_KEYS)
        .map((key) => `${UI_CONTENT_THEME_CSS_VAR_PREFIX}${key}`)
        .sort()
    );
  });

  it("does not import getOrganizationBranding in client branding modules", () => {
    const brandingDir = join(process.cwd(), "src/lib/ui/branding");
    const files = readdirSync(brandingDir).filter(
      (file) =>
        (file.endsWith(".ts") || file.endsWith(".tsx")) &&
        !file.endsWith(".test.ts") &&
        !file.endsWith(".contract.test.ts")
    );

    for (const file of files) {
      const source = readFileSync(join(brandingDir, file), "utf8");
      expect(source).not.toMatch(/getOrganizationBranding/);
    }
  });
});
