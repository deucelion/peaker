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

export function combineLocalDateAndTime(date: string, time: string): string {
  return `${date}T${time}`;
}

function formatWithTrLocale(
  iso: string,
  options: Intl.DateTimeFormatOptions
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    ...options,
  }).format(d);
}

export function formatLessonDateTimeTr(iso: string): string {
  return formatWithTrLocale(iso, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatLessonTimeTr(iso: string): string {
  return formatWithTrLocale(iso, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
