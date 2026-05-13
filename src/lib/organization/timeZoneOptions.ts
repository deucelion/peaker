/**
 * Organizasyon ayarları için saat dilimi (IANA tz) seçenekleri.
 *
 * - `Intl.supportedValuesOf("timeZone")` modern Node + tüm güncel browser'larda destekleniyor.
 * - Eski runtime'larda (yedek) kısa bir popüler liste döner.
 * - "Türkiye / komşu ülkeler" en üstte vurgulanır; diğerleri alfabetik.
 */

const PRIORITY = [
  "Europe/Istanbul",
  "Europe/Berlin",
  "Europe/London",
  "Europe/Paris",
  "Europe/Amsterdam",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Athens",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Baku",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];

const FALLBACK = [
  ...PRIORITY,
  "Europe/Vienna",
  "Europe/Brussels",
  "Europe/Stockholm",
  "Europe/Warsaw",
  "Europe/Bucharest",
  "Europe/Sofia",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Australia/Sydney",
];

export function listSupportedTimeZones(): string[] {
  try {
    type IntlWithSupportedValues = typeof Intl & {
      supportedValuesOf?: (key: "timeZone") => string[];
    };
    const intlMaybe = Intl as IntlWithSupportedValues;
    if (typeof intlMaybe.supportedValuesOf === "function") {
      const all = intlMaybe.supportedValuesOf("timeZone");
      const set = new Set(all);
      const top = PRIORITY.filter((tz) => set.has(tz));
      const rest = all.filter((tz) => !PRIORITY.includes(tz));
      rest.sort((a, b) => a.localeCompare(b));
      return [...top, ...rest];
    }
  } catch {
    /* fallback */
  }
  return FALLBACK;
}

export const POPULAR_TIME_ZONES = PRIORITY;
