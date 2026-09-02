import { buildOrganizationFeaturesFromConfigurable } from "../helpers";
import type { OrganizationFeatures } from "../types";
import { assertAlwaysOnEntitlements, createFailClosedConfigurable } from "../validation";
import { getOrganizationFeatures, KILL_SWITCH_FEATURES_REVISION } from "./getOrganizationFeatures";

function createFailClosedFeatures(): OrganizationFeatures {
  return assertAlwaysOnEntitlements(
    buildOrganizationFeaturesFromConfigurable(createFailClosedConfigurable())
  );
}

/** FAZ 31.3.4 me-access entegrasyonu icin hazir payload sekli. */
export type MeAccessOrganizationFeaturesPayload = {
  organizationFeatures: OrganizationFeatures;
  featuresRevision: number;
};

/**
 * me-access route yalnizca bu helper'i cagirir.
 * Kill-switch OFF iken Club Professional + revision 0 doner.
 * Beklenmeyen hatalarda fail-closed fallback (proxy ile hizali).
 */
export async function resolveOrganizationFeaturesForMeAccess(
  organizationId: string
): Promise<MeAccessOrganizationFeaturesPayload> {
  try {
    const runtime = await getOrganizationFeatures(organizationId);
    return {
      organizationFeatures: runtime.features,
      featuresRevision: runtime.featuresRevision,
    };
  } catch {
    return {
      organizationFeatures: createFailClosedFeatures(),
      featuresRevision: KILL_SWITCH_FEATURES_REVISION,
    };
  }
}
