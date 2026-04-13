/**
 * Lisans penceresi: `organizations.starts_at` / `ends_at` (migration: subscription window).
 * `status` ticari + operasyonel lifecycle (active, trial, expired, suspended, archived).
 *
 * Erişim sırası (organizationGate):
 * 1) archived / suspended / expired → statüye göre blok
 * 2) active / trial → tarih penceresi kontrolü (bitiş geçmişse blok, başlangıç gelecekteyse blok)
 */

import type { OrganizationStatus } from "@/lib/organization/lifecycle";
import { orgStatusBlocksProductAccess, parseOrganizationStatus } from "@/lib/organization/lifecycle";

/** Proxy / org-durumu URL parametresi; DB `status` kolonunda yok, hesaplanır. */
export const LICENSE_PENDING_GATE_STATUS = "license_pending" as const;
export type LicensePendingGateStatus = typeof LICENSE_PENDING_GATE_STATUS;

/** Tenant kullanıcıda organization_id yok (veri bütünlüğü / atama hatası). */
export const NO_ORGANIZATION_GATE_STATUS = "no_organization" as const;
export type NoOrganizationGateStatus = typeof NO_ORGANIZATION_GATE_STATUS;

/**
 * organizations satiri okunamadi (RLS, silinmis org, vb.). Gercek "suspended" ile karistirmamak icin ayri kod.
 */
export const ORGANIZATION_ROW_UNAVAILABLE_STATUS = "organization_row_unavailable" as const;
export type OrganizationRowUnavailableStatus = typeof ORGANIZATION_ROW_UNAVAILABLE_STATUS;

/** organizations lifecycle kolonları eksik; migration uygulanana kadar tenant erişimi kapalı. */
export const SCHEMA_INCOMPLETE_GATE_STATUS = "schema_incomplete" as const;
export type SchemaIncompleteGateStatus = typeof SCHEMA_INCOMPLETE_GATE_STATUS;

export type OrganizationGateStatus =
  | OrganizationStatus
  | LicensePendingGateStatus
  | NoOrganizationGateStatus
  | SchemaIncompleteGateStatus
  | OrganizationRowUnavailableStatus;

export function isLicensePendingGateStatus(s: string): s is LicensePendingGateStatus {
  return s === LICENSE_PENDING_GATE_STATUS;
}

/** active/trial dışında lisans tarihi erişimi değiştirmez (önce statü kuralı uygulanır). */
export function statusUsesLicenseWindow(status: OrganizationStatus): boolean {
  return status === "active" || status === "trial";
}

export type LicenseWindowBlock = "license_pending" | "expired_by_window";

/**
 * Statü zaten tam erişime izin veriyorsa (active/trial), tarih penceresine göre blok var mı?
 * `ends_at`: an > bitiş → süre dolmuş sayılır (admin bitişi gün sonu ISO olarak girebilir).
 */
export function evaluateLicenseWindowBlock(
  status: OrganizationStatus,
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  nowMs: number = Date.now()
): LicenseWindowBlock | null {
  if (!statusUsesLicenseWindow(status)) return null;

  const now = nowMs;
  if (startsAt) {
    const start = Date.parse(startsAt);
    if (!Number.isNaN(start) && now < start) return "license_pending";
  }
  if (endsAt) {
    const end = Date.parse(endsAt);
    if (!Number.isNaN(end) && now > end) return "expired_by_window";
  }
  return null;
}

/**
 * Gate sonucu: lisans penceresi `expired_by_window` iken URL/JSON’da `expired` ile uyumlu mesaj.
 */
export function organizationGateStatusFromLicenseBlock(block: LicenseWindowBlock): OrganizationGateStatus {
  if (block === "license_pending") return LICENSE_PENDING_GATE_STATUS;
  return "expired";
}

const EXPIRING_SOON_DAYS = 14;

export type SuperAdminLicenseSignal =
  | { kind: "ok" }
  | { kind: "no_dates" }
  | { kind: "pending_start" }
  | { kind: "expired_by_date" }
  | { kind: "expiring_soon"; daysLeft: number };

/**
 * Super admin listesi / detay için okunabilir sinyal (mock veri yok; yalnızca parametrelere göre).
 */
export function superAdminLicenseSignal(
  status: OrganizationStatus,
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  nowMs: number = Date.now()
): SuperAdminLicenseSignal {
  if (status === "archived" || status === "suspended") {
    return { kind: "ok" };
  }

  const block = evaluateLicenseWindowBlock(status, startsAt, endsAt, nowMs);
  if (block === "license_pending") return { kind: "pending_start" };
  if (block === "expired_by_window") return { kind: "expired_by_date" };

  if (!startsAt && !endsAt && (status === "active" || status === "trial")) {
    return { kind: "no_dates" };
  }

  if (endsAt && (status === "active" || status === "trial")) {
    const end = Date.parse(endsAt);
    if (!Number.isNaN(end) && nowMs <= end) {
      const daysLeft = Math.ceil((end - nowMs) / (24 * 60 * 60 * 1000));
      if (daysLeft <= EXPIRING_SOON_DAYS) {
        return { kind: "expiring_soon", daysLeft: Math.max(0, daysLeft) };
      }
    }
  }

  return { kind: "ok" };
}

export const SUPER_ADMIN_LICENSE_SIGNAL_LABELS: Record<SuperAdminLicenseSignal["kind"], string> = {
  ok: "",
  no_dates: "Lisans tarihi tanimli degil",
  pending_start: "Lisans henuz baslamadi",
  expired_by_date: "Lisans bitis tarihi gecmis",
  expiring_soon: "Lisans suresi yaklasiyor",
};

export function parseOptionalIsoDateField(raw: string | null | undefined): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw == null || String(raw).trim() === "") return { ok: true, value: null };
  const s = String(raw).trim();
  const ms = Date.parse(s);
  if (Number.isNaN(ms)) return { ok: false, error: "Gecersiz tarih/saat." };
  return { ok: true, value: new Date(ms).toISOString() };
}

export function assertEndsNotBeforeStart(
  startsAt: string | null,
  endsAt: string | null
): { ok: true } | { ok: false; error: string } {
  if (!startsAt || !endsAt) return { ok: true };
  if (Date.parse(endsAt) < Date.parse(startsAt)) {
    return { ok: false, error: "Bitis tarihi baslangictan once olamaz." };
  }
  return { ok: true };
}

export function normalizeOrganizationRowForGate(row: {
  status?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
}): { status: OrganizationStatus; startsAt: string | null; endsAt: string | null } {
  return {
    status: parseOrganizationStatus(row.status),
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
  };
}

export function describeLicenseAccessOutcome(
  status: OrganizationStatus,
  startsAt: string | null,
  endsAt: string | null,
  nowMs?: number
): "full" | "blocked_by_status" | "blocked_by_license" {
  if (orgStatusBlocksProductAccess(status)) return "blocked_by_status";
  const block = evaluateLicenseWindowBlock(status, startsAt, endsAt, nowMs);
  if (block) return "blocked_by_license";
  return "full";
}
