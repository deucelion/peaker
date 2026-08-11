import { describe, expect, it } from "vitest";
import { UI_CONTENT_THEME_VARS } from "./UI_CONTENT_THEME_VARS";
import { overlayBackdropStyle, overlayPanelStyle, overlaySelectors } from "./overlaySelectors";

describe("overlaySelectors", () => {
  it("references content theme CSS variables only", () => {
    expect(overlaySelectors.surface.panel).toBe(UI_CONTENT_THEME_VARS.SURFACE);
    expect(overlaySelectors.text.primary).toBe(UI_CONTENT_THEME_VARS.TEXT_PRIMARY);
    expect(overlaySelectors.backdrop.scrim).toContain("var(--peaker-ui-BACKGROUND)");
  });

  it("builds panel and backdrop inline styles with fallbacks", () => {
    expect(overlayPanelStyle()).toEqual({
      backgroundColor: "var(--peaker-ui-SURFACE)",
      color: "var(--peaker-ui-TEXT_PRIMARY)",
      borderColor: overlaySelectors.border.default,
    });
    expect(overlayBackdropStyle(false).backgroundColor).toBe(overlaySelectors.backdrop.scrim);
    expect(overlayBackdropStyle(true).backgroundColor).toBe(overlaySelectors.backdrop.scrimStrong);
  });

  it("does not introduce a fourth CSS namespace", () => {
    const serialized = JSON.stringify(overlaySelectors);
    expect(serialized).not.toMatch(/--peaker-layout-theme/);
    expect(serialized).not.toMatch(/--peaker-sidebar-theme/);
    expect(serialized).toMatch(/--peaker-ui-/);
  });
});
