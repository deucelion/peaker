/**
 * PEAKER_ORG_FEATURES=1 → runtime DB-backed feature okuma aktif.
 * Aksi halde (default) kill-switch: Club Professional fallback, gate etkisiz.
 */
export function isOrganizationFeaturesRuntimeEnabled(): boolean {
  const raw = process.env.PEAKER_ORG_FEATURES;
  if (raw === undefined || raw === null) {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}
