import { describe, expect, it } from "vitest";
import {
  emptyLoadingSelectors,
  loadingSpinnerColor,
  skeletonLineBackground,
  skeletonPulseBackground,
} from "./emptyLoadingSelectors";
import { UI_CONTENT_THEME_VARS } from "./UI_CONTENT_THEME_VARS";

describe("emptyLoadingSelectors", () => {
  it("binds empty/loading/KPI selectors to content theme tokens", () => {
    expect(emptyLoadingSelectors.surface).toBe(UI_CONTENT_THEME_VARS.SURFACE);
    expect(emptyLoadingSelectors.textPrimary).toBe(UI_CONTENT_THEME_VARS.TEXT_PRIMARY);
    expect(emptyLoadingSelectors.textSecondary).toBe(UI_CONTENT_THEME_VARS.TEXT_SECONDARY);
    expect(emptyLoadingSelectors.primary).toBe(UI_CONTENT_THEME_VARS.PRIMARY);
  });

  it("derives loading spinner and skeleton pulse from theme tokens", () => {
    expect(loadingSpinnerColor()).toBe(UI_CONTENT_THEME_VARS.PRIMARY);
    expect(skeletonPulseBackground()).toContain(UI_CONTENT_THEME_VARS.TEXT_PRIMARY);
    expect(skeletonLineBackground()).toContain(UI_CONTENT_THEME_VARS.TEXT_PRIMARY);
  });

  it("does not hardcode legacy hex empty/loading selector colors", () => {
    const serialized = JSON.stringify({
      emptyLoadingSelectors,
      loadingSpinnerColor,
      skeletonPulseBackground,
      skeletonLineBackground,
    });
    expect(serialized.includes("#")).toBe(false);
    expect(serialized).toContain("var(--peaker-ui-");
  });
});
