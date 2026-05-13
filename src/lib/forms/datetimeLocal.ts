/** Ders formlari: ISO string -> yerel date + time (create/update ile ayni birlestirme). */

export function splitIsoToDateAndTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const pad = (n: number) => n.toString().padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/**
 * Sadece birleşik string üretir; anlam **timezone içermez**.
 * Sunucuda `new Date(combineLocalDateAndTime(...))` UTC ortamında yanlış yorumlanır;
 * kalıcı kayıt için `wallClockInZoneToUtcIso` / `parseLessonFormInstantToUtcIso` kullanın.
 */
export function combineLocalDateAndTime(date: string, time: string): string {
  return `${date}T${time}`;
}

function formatWithTrLocale(
  iso: string,
  options: Intl.DateTimeFormatOptions,
  timeZone: string = "Europe/Istanbul"
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone,
    ...options,
  }).format(d);
}

/**
 * Ders zamanı formatı (TR locale).
 * @param timeZone Organizasyonun saat dilimi (IANA). Verilmezse global varsayılan kullanılır.
 */
export function formatLessonDateTimeTr(iso: string, timeZone: string = "Europe/Istanbul"): string {
  return formatWithTrLocale(
    iso,
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    },
    timeZone
  );
}

/**
 * Ders saati formatı (TR locale).
 * @param timeZone Organizasyonun saat dilimi (IANA). Verilmezse global varsayılan kullanılır.
 */
export function formatLessonTimeTr(iso: string, timeZone: string = "Europe/Istanbul"): string {
  return formatWithTrLocale(
    iso,
    {
      hour: "2-digit",
      minute: "2-digit",
    },
    timeZone
  );
}
