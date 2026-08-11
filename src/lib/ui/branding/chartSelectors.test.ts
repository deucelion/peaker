import { describe, expect, it } from "vitest";
import {
  chartTooltipContentStyle,
  chartTooltipItemStyle,
  chartTooltipLabelStyle,
  chartTooltipStyle,
} from "./chartSelectors";
import { UI_CONTENT_THEME_VARS } from "./UI_CONTENT_THEME_VARS";

describe("chartSelectors", () => {
  it("binds tooltip shell to content theme tokens", () => {
    const content = chartTooltipContentStyle();
    expect(content.backgroundColor).toBe(UI_CONTENT_THEME_VARS.SURFACE);
    expect(content.color).toBe(UI_CONTENT_THEME_VARS.TEXT_PRIMARY);
    expect(String(content.border)).toContain(UI_CONTENT_THEME_VARS.PRIMARY);
    expect(chartTooltipItemStyle().color).toBe(UI_CONTENT_THEME_VARS.PRIMARY);
    expect(chartTooltipLabelStyle().color).toBe(UI_CONTENT_THEME_VARS.TEXT_PRIMARY);
  });

  it("does not hardcode legacy hex tooltip colors", () => {
    const serialized = JSON.stringify(chartTooltipStyle);
    expect(serialized.includes("#")).toBe(false);
    expect(serialized).toContain("var(--peaker-ui-");
  });
});
