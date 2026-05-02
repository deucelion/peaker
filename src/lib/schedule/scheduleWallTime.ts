/**
 * Haftalık program ve ders formları: takvim günü + HH:mm değerleri
 * her zaman Europe/Istanbul duvar saati olarak yorumlanır; depolama UTC ISO (timestamptz) ile uyumludur.
 */

export const SCHEDULE_APP_TIME_ZONE = "Europe/Istanbul";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** ISO anının belirtilen bölgedeki takvim günü (YYYY-MM-DD). */
export function isoToZonedDateKey(iso: string, timeZone: string = SCHEDULE_APP_TIME_ZONE): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const g = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "";
  const y = g("year").padStart(4, "0");
  const mo = g("month").padStart(2, "0");
  const day = g("day").padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function zonedWallKeyParts(timeZone: string, instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(instant);
  const g = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "0";
  const y = g("year").padStart(4, "0");
  const mo = g("month").padStart(2, "0");
  const day = g("day").padStart(2, "0");
  const h = g("hour").padStart(2, "0");
  const mi = g("minute").padStart(2, "0");
  const s = g("second").padStart(2, "0");
  return `${y}-${mo}-${day}T${h}:${mi}:${s}`;
}

/**
 * dateKey (YYYY-MM-DD) + clock (HH:mm veya HH:mm:ss) değerini timeZone içinde duvar saati
 * olarak yorumlayıp eşdeğer UTC anını ISO string olarak döndürür.
 */
export function wallClockInZoneToUtcIso(
  dateKey: string,
  clock: string,
  timeZone: string = SCHEDULE_APP_TIME_ZONE
): string | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim());
  if (!dm) return null;
  const y = Number(dm[1]);
  const mo = Number(dm[2]);
  const d = Number(dm[3]);
  const cm = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(clock.trim());
  if (!cm) return null;
  const hh = Number(cm[1]);
  const mm = Number(cm[2]);
  const ss = cm[3] != null ? Number(cm[3]) : 0;
  if (![y, mo, d, hh, mm, ss].every((n) => Number.isFinite(n))) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59) return null;

  const target = `${String(y).padStart(4, "0")}-${pad2(mo)}-${pad2(d)}T${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;

  let lo = Date.UTC(y, mo - 1, d, 0, 0, 0) - 48 * 3600_000;
  let hi = Date.UTC(y, mo - 1, d, 0, 0, 0) + 48 * 3600_000;
  for (let i = 0; i < 64 && lo < hi; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const key = zonedWallKeyParts(timeZone, new Date(mid));
    if (key < target) lo = mid + 1;
    else hi = mid;
  }
  const hit = zonedWallKeyParts(timeZone, new Date(lo));
  if (hit !== target) return null;
  return new Date(lo).toISOString();
}

/** Haftalık ızgara: o anın İstanbul (veya tz) duvar saatindeki dakika (gün başına göre). */
export function isoToZonedClockMinutesFromMidnight(iso: string, timeZone: string = SCHEDULE_APP_TIME_ZONE): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? NaN);
  const mi = Number(parts.find((p) => p.type === "minute")?.value ?? NaN);
  if (!Number.isFinite(h) || !Number.isFinite(mi)) return 0;
  return h * 60 + mi;
}

export function zonedNowClockMinutes(
  now: Date,
  timeZone: string = SCHEDULE_APP_TIME_ZONE
): { minutesFromDayStart: number; dateKey: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(now);
  const g = (t: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === t)?.value ?? NaN);
  const y = g("year");
  const mo = g("month");
  const day = g("day");
  const h = g("hour");
  const mi = g("minute");
  const dateKey = `${String(y).padStart(4, "0")}-${pad2(mo)}-${pad2(day)}`;
  return { minutesFromDayStart: h * 60 + mi, dateKey };
}

function hasExplicitTimeZone(s: string): boolean {
  const v = s.trim();
  return /[zZ]$/.test(v) || /[+-]\d{2}:\d{2}$/.test(v) || /[+-]\d{4}$/.test(v);
}

/**
 * Formdan gelen başlangıç/bitiş: tam ISO (Z veya offset) ise aynen UTC'ye çevrilir;
 * aksi halde YYYY-MM-DDTHH:mm veya YYYY-MM-DD HH:mm naif değer İstanbul duvar saati kabul edilir.
 */
export function parseLessonFormInstantToUtcIso(
  raw: string,
  timeZone: string = SCHEDULE_APP_TIME_ZONE
): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (hasExplicitTimeZone(v)) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(v);
  if (m) {
    const dateKey = m[1];
    const clock = m[3] ? `${m[2]}:${m[3]}` : m[2];
    return wallClockInZoneToUtcIso(dateKey, clock, timeZone);
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
