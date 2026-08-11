import { UI_CONTENT_THEME_VARS } from "./UI_CONTENT_THEME_VARS";

/** Recharts tooltip shell — content theme tokens only (Wave 10). */
export function chartTooltipContentStyle(): Record<string, string | number> {
  return {
    backgroundColor: UI_CONTENT_THEME_VARS.SURFACE,
    border: `1px solid color-mix(in srgb, ${UI_CONTENT_THEME_VARS.PRIMARY} 20%, transparent)`,
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: "bold",
    color: UI_CONTENT_THEME_VARS.TEXT_PRIMARY,
  };
}

export function chartTooltipItemStyle(): Record<string, string> {
  return {
    color: UI_CONTENT_THEME_VARS.PRIMARY,
  };
}

export function chartTooltipLabelStyle(): Record<string, string | number> {
  return {
    color: UI_CONTENT_THEME_VARS.TEXT_PRIMARY,
    marginBottom: "8px",
    fontWeight: "900",
  };
}

/** Module-level export for existing Recharts consumers. */
export const chartTooltipStyle = {
  get contentStyle() {
    return chartTooltipContentStyle();
  },
  get itemStyle() {
    return chartTooltipItemStyle();
  },
  get labelStyle() {
    return chartTooltipLabelStyle();
  },
} as const;
