/**
 * PEAKER_ORG_BRANDING=1 → runtime DB-backed branding okuma aktif.
 * Aksi halde (default) kill-switch: Peaker default branding, DB sorgusu yok.
 */
export function isOrganizationBrandingRuntimeEnabled(): boolean {
  const raw = process.env.PEAKER_ORG_BRANDING;
  if (raw === undefined || raw === null) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}
