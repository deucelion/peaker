import "server-only";

import type { MeAccessApiPayload } from "@/lib/auth/meAccessBootstrap";
import { resolveMeAccessApiPayloadWithRequestCache } from "@/lib/auth/meAccessBootstrap";
import { createDefaultBranding } from "@/lib/organization/branding/defaults";
import { createClubProfessionalFeatures } from "@/lib/organization/features/presets";
import { extractContentThemeTokens } from "@/lib/ui/branding/UI_CONTENT_THEME_VARS";

export type MeAccessServerSnapshot = MeAccessApiPayload;

export function isSsrBrandingEnabled(): boolean {
  return process.env.PEAKER_SSR_BRANDING !== "0";
}

export async function loadMeAccessServerSnapshot(): Promise<MeAccessServerSnapshot | null> {
  if (!isSsrBrandingEnabled()) {
    return null;
  }

  const result = await resolveMeAccessApiPayloadWithRequestCache();
  if ("error" in result) {
    return null;
  }

  return result;
}

export function createInitialBrandingFromMeAccess(
  snapshot: MeAccessServerSnapshot | null | undefined
) {
  if (!snapshot) {
    return createDefaultBranding();
  }

  return snapshot.organizationBranding;
}

export function createInitialContentThemeTokens(
  snapshot: MeAccessServerSnapshot | null | undefined
) {
  return extractContentThemeTokens(createInitialBrandingFromMeAccess(snapshot).theme);
}

export function createInitialOrganizationFeatures(
  snapshot: MeAccessServerSnapshot | null | undefined
) {
  return snapshot?.organizationFeatures ?? createClubProfessionalFeatures();
}
