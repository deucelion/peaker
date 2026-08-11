import { describe, expect, it } from "vitest";
import {
  tableHeadStyle,
  tableRowHoverStyle,
  tableSelectors,
  tableShellStyle,
} from "./tableSelectors";
import { UI_CONTENT_THEME_VARS } from "./UI_CONTENT_THEME_VARS";

describe("tableSelectors", () => {
  it("binds table shell to content theme tokens", () => {
    const shell = tableShellStyle();
    expect(shell.backgroundColor).toBe(UI_CONTENT_THEME_VARS.SURFACE);
    expect(shell.color).toBe(UI_CONTENT_THEME_VARS.TEXT_PRIMARY);
  });

  it("binds table head and row hover to content theme tokens", () => {
    const head = tableHeadStyle();
    expect(String(head.backgroundColor)).toContain(UI_CONTENT_THEME_VARS.SURFACE);
    expect(String(head.backgroundColor)).toContain(UI_CONTENT_THEME_VARS.TEXT_PRIMARY);
    expect(head.color).toBe(UI_CONTENT_THEME_VARS.TEXT_SECONDARY);

    const hover = tableRowHoverStyle();
    expect(String(hover.backgroundColor)).toContain(UI_CONTENT_THEME_VARS.PRIMARY);
  });

  it("exports table selector contract aligned with UI content vars", () => {
    expect(tableSelectors.surface).toBe(UI_CONTENT_THEME_VARS.SURFACE);
    expect(tableSelectors.textPrimary).toBe(UI_CONTENT_THEME_VARS.TEXT_PRIMARY);
    expect(tableSelectors.textSecondary).toBe(UI_CONTENT_THEME_VARS.TEXT_SECONDARY);
    expect(tableSelectors.primary).toBe(UI_CONTENT_THEME_VARS.PRIMARY);
  });

  it("does not hardcode legacy hex table selector colors", () => {
    const serialized = JSON.stringify({ tableShellStyle, tableHeadStyle, tableRowHoverStyle, tableSelectors });
    expect(serialized.includes("#")).toBe(false);
    expect(serialized).toContain("var(--peaker-ui-");
  });
});
