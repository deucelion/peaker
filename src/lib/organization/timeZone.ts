import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { SCHEDULE_APP_TIME_ZONE } from "@/lib/schedule/scheduleWallTime";

/**
 * Organizasyon başına saat dilimi çözücü.
 * - DB'de `organizations.time_zone` (multi-tenant timezone migration ile gelir)
 * - Eksik / hatalı / org bulunamadıysa global varsayılana düşer (`SCHEDULE_APP_TIME_ZONE`)
 * - Per-process basit cache (kısa ömürlü) — server action içi tekrar tekrar sorgu yapmamak için
 *
 * Sadece sunucu tarafında kullanılır (admin client gerektirir).
 */

const TZ_CACHE = new Map<string, { tz: string; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

/** IANA tz ID kabaca doğrulayan regex; PostgreSQL constraint ile aynı kabul kriterleri. */
const IANA_TZ_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*\/[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z][A-Za-z0-9_+-]*)?$/;

export function isLikelyIanaTimeZone(value: string | null | undefined): boolean {
  const s = String(value || "").trim();
  if (!s) return false;
  if (s === "UTC") return true;
  if (!IANA_TZ_PATTERN.test(s)) return false;
  // Intl ile çalıştırılabilir mi? (ör. çekirdek Node sürümü destekliyor mu)
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: s }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/**
 * Organizasyonun saat dilimini döndürür. Bilinmiyorsa global varsayılana düşer.
 * Hiç db çağrısı atılmaması gereken yol için `getDefaultAppTimeZone` kullanın.
 */
export async function resolveOrganizationTimeZone(
  organizationId: string | null | undefined
): Promise<string> {
  const orgId = String(organizationId || "").trim();
  if (!orgId) return SCHEDULE_APP_TIME_ZONE;

  const now = Date.now();
  const cached = TZ_CACHE.get(orgId);
  if (cached && cached.expiresAt > now) return cached.tz;

  try {
    const adminClient = createSupabaseAdminClient();
    const { data, error } = await adminClient
      .from("organizations")
      .select("time_zone")
      .eq("id", orgId)
      .maybeSingle();

    if (error || !data) {
      TZ_CACHE.set(orgId, { tz: SCHEDULE_APP_TIME_ZONE, expiresAt: now + CACHE_TTL_MS });
      return SCHEDULE_APP_TIME_ZONE;
    }

    const raw = String((data as { time_zone?: string | null }).time_zone || "").trim();
    const tz = isLikelyIanaTimeZone(raw) ? raw : SCHEDULE_APP_TIME_ZONE;
    TZ_CACHE.set(orgId, { tz, expiresAt: now + CACHE_TTL_MS });
    return tz;
  } catch {
    return SCHEDULE_APP_TIME_ZONE;
  }
}

/** Hiç DB çağrısı yapmadan, varsayılan saat dilimi (Europe/Istanbul). */
export function getDefaultAppTimeZone(): string {
  return SCHEDULE_APP_TIME_ZONE;
}

/**
 * Cache invalidation:
 * - `organizationId` verilirse yalnızca o tenant cache'i temizlenir.
 * - Argümansız çağrı (admin/super_admin TZ değiştirdikten sonra) tüm cache'i temizler;
 *   bu sayede aynı process'teki başka org'lar etkilenmez ama ileri-uyumlu kalır.
 *
 * Bu hook'u TZ'yi değiştiren her server action sonrasında çağırın.
 */
export function invalidateOrganizationTimeZoneCache(organizationId?: string | null): void {
  const orgId = String(organizationId || "").trim();
  if (!orgId) {
    TZ_CACHE.clear();
    return;
  }
  TZ_CACHE.delete(orgId);
}
