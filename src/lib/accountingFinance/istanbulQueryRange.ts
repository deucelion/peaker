/**
 * Muhasebe & Finans (ve benzeri) listeleri: HTML `type="month"` / `type="date"` değerleri
 * Europe/Istanbul duvar takvimi olarak yorumlanır; Supabase sorguları UTC yarı-açık aralık [from, toExclusive) ile yapılır.
 */

import { SCHEDULE_APP_TIME_ZONE, wallClockInZoneToUtcIso } from "@/lib/schedule/scheduleWallTime";

const TZ = SCHEDULE_APP_TIME_ZONE;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Türkiye'de DST olmadığı için gün sonuna +24h güvenli. */
function addUtcMs(iso: string, ms: number): string {
  return new Date(new Date(iso).getTime() + ms).toISOString();
}

/**
 * İstanbul'da dateFrom … dateTo (dahil) günleri → [fromUtc, toExclusiveUtc).
 * dateFrom / dateTo: `YYYY-MM-DD`
 */
export function istanbulDateWallRangeToHalfOpenUtc(
  dateFrom: string,
  dateTo: string
): { from: string; toExclusive: string } | null {
  const a = dateFrom.trim();
  const b = dateTo.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return null;
  if (a > b) return null;
  const fromIso = wallClockInZoneToUtcIso(a, "00:00:00", TZ);
  const endStartIso = wallClockInZoneToUtcIso(b, "00:00:00", TZ);
  if (!fromIso || !endStartIso) return null;
  const toExclusive = addUtcMs(endStartIso, 86_400_000);
  if (new Date(toExclusive).getTime() <= new Date(fromIso).getTime()) return null;
  return { from: fromIso, toExclusive };
}

/** `YYYY-MM` ayı, İstanbul takvim ayı başlangıcı → bir sonraki ay başına kadar [from, toExclusive). */
export function istanbulMonthWallToHalfOpenUtc(monthKey: string): { from: string; toExclusive: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) return null;
  const fromKey = `${y}-${pad2(mo)}-01`;
  const fromIso = wallClockInZoneToUtcIso(fromKey, "00:00:00", TZ);
  if (!fromIso) return null;
  let ny = y;
  let nm = mo + 1;
  if (nm > 12) {
    nm = 1;
    ny += 1;
  }
  const nextKey = `${ny}-${pad2(nm)}-01`;
  const toExclusive = wallClockInZoneToUtcIso(nextKey, "00:00:00", TZ);
  if (!toExclusive) return null;
  return { from: fromIso, toExclusive };
}

/** `lesson_date` (DATE) sütunu için ay içi inclusive YYYY-MM-DD (Gregory, İstanbul ile uyumlu gün numarası). */
export function istanbulMonthToPayoutDateInclusiveBounds(monthKey: string): { fromKey: string; toKeyInclusive: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) return null;
  const fromKey = `${y}-${pad2(mo)}-01`;
  const lastDay = new Date(y, mo, 0).getDate();
  const toKeyInclusive = `${y}-${pad2(mo)}-${pad2(lastDay)}`;
  return { fromKey, toKeyInclusive };
}

/** Özel tarih aralığı için `lesson_date` inclusive sınırlar (string gün anahtarları). */
export function istanbulCustomRangeToPayoutDateInclusiveBounds(
  dateFrom: string,
  dateTo: string
): { fromKey: string; toKeyInclusive: string } | null {
  const a = dateFrom.trim();
  const b = dateTo.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return null;
  if (a > b) return null;
  return { fromKey: a, toKeyInclusive: b };
}
