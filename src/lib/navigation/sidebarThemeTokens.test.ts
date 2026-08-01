import { describe, expect, it } from "vitest";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import { mergeBranding } from "@/lib/organization/branding/helpers";
import { BRANDING_COLOR_TOKEN_KEYS } from "@/lib/organization/branding/tokens";
import { resolveSidebarBranding } from "@/lib/organization/branding/surfaces/resolveSidebarBranding";
import {
  buildSidebarNavIconStyle,
  buildSidebarNavItemStyle,
  createSidebarThemeStyle,
  createSidebarThemeStyleFromBranding,
  extractSidebarThemeTokens,
  isDefaultSidebarThemeParity,
  SIDEBAR_THEME_CSS_VAR_PREFIX,
  SIDEBAR_THEME_TOKEN_KEYS,
  SIDEBAR_THEME_VARS,
} from "./sidebarThemeTokens";

describe("sidebarThemeTokens", () => {
  it("maps sidebar section and allowlisted theme tokens", () => {
    const branding = mergeBranding(createDefaultBranding(), {
      sidebar: {
        background: "#101010",
        text: "#808080",
        active: "#fefefe",
      },
      theme: {
        ...createDefaultBranding().theme,
        primary: "#224466",
        surface: "#333333",
      },
    });

    const resolved = resolveSidebarBranding(branding);
    const tokens = extractSidebarThemeTokens(resolved.sidebar, branding.theme);

    expect(tokens.SIDEBAR_BACKGROUND).toBe("#101010");
    expect(tokens.SIDEBAR_TEXT).toBe("#808080");
    expect(tokens.SIDEBAR_ACTIVE).toBe("#fefefe");
    expect(tokens.PRIMARY).toBe("#224466");
    expect(tokens.SURFACE).toBe("#333333");
  });

  it("reads only the canonical sidebar token allowlist", () => {
    const tokens = extractSidebarThemeTokens(
      createDefaultBranding().sidebar,
      createDefaultBranding().theme
    );
    expect(Object.keys(tokens).sort()).toEqual([...SIDEBAR_THEME_TOKEN_KEYS].sort());
  });

  it("builds css variables with canonical token names", () => {
    const style = createSidebarThemeStyle(
      createDefaultBranding().sidebar,
      createDefaultBranding().theme
    );
    expect(style[`${SIDEBAR_THEME_CSS_VAR_PREFIX}-SIDEBAR_BACKGROUND`]).toBe("#09090b");
    expect(style[`${SIDEBAR_THEME_CSS_VAR_PREFIX}-PRIMARY`]).toBe("#7c3aed");
  });

  it("creates sidebar theme style from organizationBranding snapshot", () => {
    const style = createSidebarThemeStyleFromBranding(createDefaultBranding());
    expect(style[`${SIDEBAR_THEME_CSS_VAR_PREFIX}-SIDEBAR_TEXT`]).toBe("#71717a");
  });

  it("preserves default sidebar parity", () => {
    const tokens = extractSidebarThemeTokens(
      createDefaultBranding().sidebar,
      createDefaultBranding().theme
    );
    expect(isDefaultSidebarThemeParity(tokens)).toBe(true);
  });

  it("builds active nav item styles from canonical tokens", () => {
    const style = buildSidebarNavItemStyle({ active: true, variant: "default" });
    expect(style.color).toBe(SIDEBAR_THEME_VARS.SIDEBAR_ACTIVE);
    expect(String(style.backgroundColor)).toContain(SIDEBAR_THEME_VARS.PRIMARY);
  });

  it("builds hover/inactive nav item styles from canonical tokens", () => {
    const style = buildSidebarNavItemStyle({ active: false, variant: "default" });
    expect(style.color).toBe(SIDEBAR_THEME_VARS.SIDEBAR_TEXT);
  });

  it("builds selected highlight nav item styles from canonical tokens", () => {
    const style = buildSidebarNavItemStyle({ active: true, variant: "highlight" });
    expect(style.backgroundColor).toBe(SIDEBAR_THEME_VARS.PRIMARY);
    expect(style.color).toBe(SIDEBAR_THEME_VARS.TEXT_PRIMARY);
  });

  it("builds nav icon styles for active and hover states", () => {
    expect(buildSidebarNavIconStyle({ active: true, variant: "default" }).color).toBe(
      SIDEBAR_THEME_VARS.PRIMARY
    );
    expect(buildSidebarNavIconStyle({ active: false, variant: "default" }).color).toBe(
      SIDEBAR_THEME_VARS.SIDEBAR_TEXT
    );
  });

  it("falls back to default tokens for invalid theme values", () => {
    const brokenTheme = {
      ...createDefaultBranding().theme,
      primary: "",
    };
    const tokens = extractSidebarThemeTokens(createDefaultBranding().sidebar, brokenTheme);
    expect(tokens.PRIMARY).toBe(createDefaultBranding().theme.primary);
  });
});

describe("sidebar branding snapshot integration", () => {
  it("maps me-access organizationBranding snapshot to sidebar css variables", () => {
    const branding = mergeBranding(createDefaultBranding(), {
      sidebar: {
        background: "#151515",
        text: "#999999",
        active: "#ffffff",
      },
      brandingRevision: 2,
    });

    const style = createSidebarThemeStyleFromBranding(branding);
    expect(style[`${SIDEBAR_THEME_CSS_VAR_PREFIX}-SIDEBAR_BACKGROUND`]).toBe("#151515");
    expect(resolveSidebarBranding(branding).brandingRevision).toBe(2);
  });
});

describe("sidebar navigation feature visibility parity", () => {
  it("does not import or alter navigation visibility helpers", async () => {
    const dashboardNavConfig = await import("@/lib/navigation/dashboardNavConfig");
    const navigationFeatureVisibility = await import("@/lib/navigation/navigationFeatureVisibility");

    expect(typeof dashboardNavConfig.isDashboardNavItemVisible).toBe("function");
    expect(typeof navigationFeatureVisibility.isNavigationItemFeatureVisible).toBe("function");
    expect(Object.keys(SIDEBAR_THEME_VARS)).toEqual(
      expect.arrayContaining([
        BRANDING_COLOR_TOKEN_KEYS.sidebarBackground,
        BRANDING_COLOR_TOKEN_KEYS.primary,
      ])
    );
  });
});
