"use client";

import { createContext, useContext } from "react";
import type { OrganizationBranding } from "@/lib/organization/branding/types";
import type { UiBrandingClasses } from "./uiBrandingClasses";
import { uiBrandingClasses } from "./uiBrandingClasses";
import type { UiBrandingSelectorMatrix } from "./uiBrandingSelectors";
import { buildUiBrandingSelectorMatrix, uiBrandingSelectors } from "./uiBrandingSelectors";
import type { UiContentThemeTokenSnapshot } from "./UI_CONTENT_THEME_VARS";
import { UI_CONTENT_THEME_VARS } from "./UI_CONTENT_THEME_VARS";
import { resolveContentThemeTokens, resolveOrganizationBrandingSnapshot } from "./uiBrandingHelpers";

export type BrandingUiContextValue = {
  readonly ready: boolean;
  readonly brandingRevision: number;
  readonly organizationBranding: OrganizationBranding;
  readonly tokens: UiContentThemeTokenSnapshot;
  readonly contentThemeVars: typeof UI_CONTENT_THEME_VARS;
  readonly selectors: typeof uiBrandingSelectors;
  readonly selectorMatrix: UiBrandingSelectorMatrix;
  readonly classes: UiBrandingClasses;
};

export const BrandingUiContext = createContext<BrandingUiContextValue | null>(null);

export function useBrandingUi(): BrandingUiContextValue {
  const value = useContext(BrandingUiContext);
  if (value === null) {
    throw new Error("useBrandingUi must be used within BrandingUiProvider");
  }
  return value;
}

export function createBrandingUiContextValue(input: {
  organizationBranding?: OrganizationBranding | null | unknown;
  ready?: boolean;
}): BrandingUiContextValue {
  const organizationBranding = resolveOrganizationBrandingSnapshot(input.organizationBranding);
  const tokens = resolveContentThemeTokens(organizationBranding);

  return Object.freeze({
    ready: input.ready ?? true,
    brandingRevision: organizationBranding.brandingRevision,
    organizationBranding,
    tokens,
    contentThemeVars: UI_CONTENT_THEME_VARS,
    selectors: uiBrandingSelectors,
    selectorMatrix: buildUiBrandingSelectorMatrix(tokens),
    classes: uiBrandingClasses,
  });
}
