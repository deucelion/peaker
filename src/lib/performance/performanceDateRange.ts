import { istanbulDateWallRangeToHalfOpenUtc } from "@/lib/accountingFinance/istanbulQueryRange";
import { isoToZonedDateKey, SCHEDULE_APP_TIME_ZONE } from "@/lib/schedule/scheduleWallTime";

/** `YYYY-MM-DD` + takvim günü offseti (Gregory, UTC tarih bileşenleri). */
export function addCalendarDaysToYyyyMmDd(dateKey: string, deltaDays: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim());
  if (!m) return dateKey.trim();
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (![y, mo, d].every((n) => Number.isFinite(n))) return dateKey.trim();
  const t = Date.UTC(y, mo - 1, d) + deltaDays * 86_400_000;
  const nd = new Date(t);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${nd.getUTCFullYear()}-${pad(nd.getUTCMonth() + 1)}-${pad(nd.getUTCDate())}`;
}

export function isYyyyMmDd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
}

/**
 * Bugünün takvim anahtarı (organizasyon saat dilimine göre).
 * @param tz IANA tz; verilmezse global varsayılan.
 */
export function istanbulTodayKey(tz: string = SCHEDULE_APP_TIME_ZONE): string {
  return isoToZonedDateKey(new Date().toISOString(), tz);
}

/**
 * Son N takvim günü (bugün dahil): [from, to]. N>=1
 * @param tz IANA tz; verilmezse global varsayılan.
 */
export function istanbulLastNDaysInclusive(
  n: number,
  tz: string = SCHEDULE_APP_TIME_ZONE
): { from: string; to: string } {
  const to = istanbulTodayKey(tz);
  const from = addCalendarDaysToYyyyMmDd(to, -(Math.max(1, n) - 1));
  return { from, to };
}

/**
 * ACWR/EWMA için: görünür aralığın başlangıcından 28 gün önceki güne kadar yarı-açık UTC aralığı.
 * @param tz IANA tz; verilmezse global varsayılan.
 */
export function istanbulLoadFetchRangeForPerformance(
  visibleFrom: string,
  visibleTo: string,
  tz: string = SCHEDULE_APP_TIME_ZONE
) {
  const lookbackFrom = addCalendarDaysToYyyyMmDd(visibleFrom.trim(), -28);
  return istanbulDateWallRangeToHalfOpenUtc(lookbackFrom, visibleTo.trim(), tz);
}
