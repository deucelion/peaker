"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import type { OrganizationBranding } from "@/lib/organization/branding/types";
import { createContentThemeStyle } from "./UI_CONTENT_THEME_VARS";
import {
  BrandingUiContext,
  createBrandingUiContextValue,
  type BrandingUiContextValue,
} from "./BrandingUiContext";

export type BrandingUiProviderProps = {
  readonly organizationBranding?: OrganizationBranding | null | unknown;
  readonly ready?: boolean;
  readonly children: ReactNode;
};

export function BrandingUiProvider({
  organizationBranding,
  ready = true,
  children,
}: BrandingUiProviderProps) {
  const value = useMemo<BrandingUiContextValue>(
    () =>
      createBrandingUiContextValue({
        organizationBranding,
        ready,
      }),
    [organizationBranding, ready]
  );

  const contentThemeStyle = useMemo<CSSProperties>(
    () => createContentThemeStyle(value.organizationBranding.theme),
    [value.organizationBranding.theme]
  );

  return (
    <BrandingUiContext.Provider value={value}>
      <div data-peaker-ui-content-root style={contentThemeStyle}>
        {children}
      </div>
    </BrandingUiContext.Provider>
  );
}
