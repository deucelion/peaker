import { describe, expect, it } from "vitest";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import { mergeBranding } from "@/lib/organization/branding/helpers";
import { extractContentThemeTokens, isDefaultContentThemeParity } from "./UI_CONTENT_THEME_VARS";
import {
  focusRingBorder,
  mixPrimary,
  resolveContentThemeTokens,
  resolveOrganizationBrandingSnapshot,
} from "./uiBrandingHelpers";

describe("uiBrandingHelpers", () => {
  it("resolves null snapshot to default branding", () => {
    const resolved = resolveOrganizationBrandingSnapshot(null);
    expect(resolved).toEqual(createDefaultBranding());
  });

  it("resolves invalid snapshot payload to default branding", () => {
    const resolved = resolveOrganizationBrandingSnapshot({ schemaVersion: 999, theme: "invalid" });
    expect(resolved.theme.primary).toBe("#7c3aed");
    expect(resolved.brandingRevision).toBe(0);
  });

  it("falls back to default theme tokens for partial invalid branding", () => {
    const partial = mergeBranding(createDefaultBranding(), {
      theme: {
        ...createDefaultBranding().theme,
        primary: "#112233",
      },
    });

    const tokens = resolveContentThemeTokens(partial);
    expect(tokens.PRIMARY).toBe("#112233");
    expect(tokens.SURFACE).toBe("#121215");
  });

  it("detects default content theme parity", () => {
    const tokens = extractContentThemeTokens(createDefaultBranding().theme);
    expect(isDefaultContentThemeParity(tokens)).toBe(true);
  });

  it("detects custom branding divergence from default parity", () => {
    const tokens = resolveContentThemeTokens(
      mergeBranding(createDefaultBranding(), {
        theme: {
          ...createDefaultBranding().theme,
          primary: "#112233",
        },
      })
    );
    expect(isDefaultContentThemeParity(tokens)).toBe(false);
  });

  it("builds primary mix and focus ring helpers from content CSS vars", () => {
    expect(mixPrimary(20)).toBe("color-mix(in srgb, var(--peaker-ui-PRIMARY) 20%, transparent)");
    expect(focusRingBorder()).toBe(
      "color-mix(in srgb, var(--peaker-ui-PRIMARY) 60%, transparent)"
    );
  });
});
