import type { OrganizationBranding } from "../types";
import { createDefaultBranding } from "../defaults";
import { getOrganizationBranding, KILL_SWITCH_BRANDING_REVISION } from "./getOrganizationBranding";

/** FAZ 32.4 me-access entegrasyonu icin hazir payload sekli. */
export type MeAccessOrganizationBrandingPayload = {
  organizationBranding: OrganizationBranding;
  brandingRevision: number;
};

/**
 * me-access route yalnizca bu helper'i cagirir.
 * Kill-switch OFF iken Peaker default branding + revision 0 doner.
 * Beklenmeyen hatalarda da ayni guvenli fallback kullanilir.
 */
export async function resolveOrganizationBrandingForMeAccess(
  organizationId: string
): Promise<MeAccessOrganizationBrandingPayload> {
  try {
    const runtime = await getOrganizationBranding(organizationId);
    return {
      organizationBranding: runtime.branding,
      brandingRevision: runtime.brandingRevision,
    };
  } catch {
    return {
      organizationBranding: createDefaultBranding(),
      brandingRevision: KILL_SWITCH_BRANDING_REVISION,
    };
  }
}
