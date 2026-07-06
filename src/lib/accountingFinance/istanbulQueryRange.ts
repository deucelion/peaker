/**
 * Muhasebe & Finans (ve benzeri) listeleri: HTML `type="month"` / `type="date"` değerleri
 * Europe/Istanbul duvar takvimi olarak yorumlanır; Supabase sorguları UTC yarı-açık aralık [from, toExclusive) ile yapılır.
 */

import { SCHEDULE_APP_TIME_ZONE, wallClockInZoneToUtcIso } from "@/lib/schedule/scheduleWallTime";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** DST atlamalarına dayanıklı: ay sınırlarını duvar saati üzerinden hesaplar; sabit +24h yapmaz. */
function nextDayWallClock(dateKey: string, tz: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const t = Date.UTC(y, mo - 1, d) + 86_400_000;
  const nd = new Date(t);
  const nextKey = `${nd.getUTCFullYear()}-${pad2(nd.getUTCMonth() + 1)}-${pad2(nd.getUTCDate())}`;
  return wallClockInZoneToUtcIso(nextKey, "00:00:00", tz);
}

/**
 * İstanbul'da dateFrom … dateTo (dahil) günleri → [fromUtc, toExclusiveUtc).
 * dateFrom / dateTo: `YYYY-MM-DD`
 *
 * @param tz Organizasyon saat dilimi (IANA). Verilmezse global varsayılan kullanılır.
 */
export function istanbulDateWallRangeToHalfOpenUtc(
  dateFrom: string,
  dateTo: string,
  tz: string = SCHEDULE_APP_TIME_ZONE
): { from: string; toExclusive: string } | null {
  const a = dateFrom.trim();
  const b = dateTo.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return null;
  if (a > b) return null;
  const fromIso = wallClockInZoneToUtcIso(a, "00:00:00", tz);
  const toExclusive = nextDayWallClock(b, tz);
  if (!fromIso || !toExclusive) return null;
  if (new Date(toExclusive).getTime() <= new Date(fromIso).getTime()) return null;
  return { from: fromIso, toExclusive };
}

/**
 * `YYYY-MM` ayı, organizasyon takvim ayı başlangıcı → bir sonraki ay başına kadar [from, toExclusive).
 *
 * @param tz Organizasyon saat dilimi (IANA). Verilmezse global varsayılan kullanılır.
 */
export function istanbulMonthWallToHalfOpenUtc(
  monthKey: string,
  tz: string = SCHEDULE_APP_TIME_ZONE
): { from: string; toExclusive: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) return null;
  const fromKey = `${y}-${pad2(mo)}-01`;
  const fromIso = wallClockInZoneToUtcIso(fromKey, "00:00:00", tz);
  if (!fromIso) return null;
  let ny = y;
  let nm = mo + 1;
  if (nm > 12) {
    nm = 1;
    ny += 1;
  }
  const nextKey = `${ny}-${pad2(nm)}-01`;
  const toExclusive = wallClockInZoneToUtcIso(nextKey, "00:00:00", tz);
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

/** Duvar takvimi gün anahtarları arasındaki gün sayısı (her iki uç dahil). */
export function wallDateRangeDayCountInclusive(dateFrom: string, dateTo: string): number | null {
  const a = dateFrom.trim();
  const b = dateTo.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return null;
  if (a > b) return null;
  const start = Date.UTC(Number(a.slice(0, 4)), Number(a.slice(5, 7)) - 1, Number(a.slice(8, 10)));
  const end = Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1, Number(b.slice(8, 10)));
  return Math.floor((end - start) / 86_400_000) + 1;
}

/** Muhasebe özel tarih aralığı üst sınırı (performans koruması). */
export const MAX_ACCOUNTING_CUSTOM_RANGE_DAYS = 366;
