import type { LogoBrandingSnapshot } from "@/lib/organization/branding/surfaces/resolveLogoBranding";
import type { BrandingAssetReference } from "@/lib/organization/branding/types";

export type LogoBrandingModel = {
  asset: BrandingAssetReference;
  markInitial: string;
  accessibilityLabel: string;
};

export function createLogoBrandingModel(
  snapshot: LogoBrandingSnapshot,
  shortName: string
): LogoBrandingModel {
  const initial = shortName.trim().charAt(0).toUpperCase();
  return {
    asset: snapshot.logo,
    markInitial: initial.length > 0 ? initial : "P",
    accessibilityLabel: snapshot.logo.assetId,
  };
}
