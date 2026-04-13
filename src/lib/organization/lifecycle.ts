/**
 * Merkezi organizasyon lifecycle sabitleri ve yardımcıları.
 * DB check constraint ile aynı küme tutulmalıdır.
 *
 * Lisans penceresi: `organizations.starts_at` / `ends_at` (ayrı kolon yok). Kurallar: `@/lib/organization/license`.
 */
export const ORGANIZATION_STATUSES = ["active", "suspended", "archived", "trial", "expired"] as const;

export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export function parseOrganizationStatus(raw: string | null | undefined): OrganizationStatus {
  if (raw && (ORGANIZATION_STATUSES as readonly string[]).includes(raw)) {
    return raw as OrganizationStatus;
  }
  return "active";
}

/** Panel ve operasyonel işler: yalnızca bu statülerde tam erişim. */
export function orgStatusAllowsFullProductAccess(status: OrganizationStatus): boolean {
  return status === "active" || status === "trial";
}

export function orgStatusBlocksProductAccess(status: OrganizationStatus): boolean {
  return !orgStatusAllowsFullProductAccess(status);
}

export const ORGANIZATION_STATUS_LABELS: Record<OrganizationStatus, string> = {
  active: "Aktif",
  suspended: "Askıda",
  archived: "Arşivlendi",
  trial: "Deneme",
  expired: "Süresi doldu",
};

export function canSuspendOrganizationStatus(current: OrganizationStatus): boolean {
  return current === "active" || current === "trial";
}

export function canArchiveOrganizationStatus(current: OrganizationStatus): boolean {
  return current !== "archived";
}

export function canReactivateOrganizationStatus(current: OrganizationStatus): boolean {
  return current === "suspended" || current === "archived" || current === "expired";
}

export type LifecycleAction = "suspend" | "archive" | "reactivate";

export function assertLifecycleTransition(
  action: LifecycleAction,
  current: OrganizationStatus
): { ok: true; next: OrganizationStatus } | { ok: false; message: string } {
  switch (action) {
    case "suspend":
      if (!canSuspendOrganizationStatus(current)) {
        return { ok: false, message: "Yalnızca aktif veya deneme statüsündeki organizasyon askıya alınabilir." };
      }
      return { ok: true, next: "suspended" };
    case "archive":
      if (!canArchiveOrganizationStatus(current)) {
        return { ok: false, message: "Bu organizasyon zaten arşivlenmiş." };
      }
      return { ok: true, next: "archived" };
    case "reactivate":
      if (!canReactivateOrganizationStatus(current)) {
        return { ok: false, message: "Yalnızca askıda, arşiv veya süresi dolmuş organizasyon yeniden aktifleştirilebilir." };
      }
      return { ok: true, next: "active" };
    default:
      return { ok: false, message: "Gecersiz islem." };
  }
}
