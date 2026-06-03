/** PDF icinde gosterilecek kisi adi (her kelimenin ilk harfi buyuk). */
export function formatPdfPersonName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase("tr-TR") + part.slice(1).toLocaleLowerCase("tr-TR"))
    .join(" ");
}

/** Bilinen indeks metriklerinde yanlis birim duzeltmesi. */
export function formatPdfMetricUnit(metricName: string, unit: string | null | undefined): string {
  const u = (unit || "").trim();
  const n = metricName.toUpperCase();
  if (!u || u.toLowerCase() === "not") return "—";
  if (/\b(RSI|DJ|REACTIVE STRENGTH)\b/.test(n) && /^CM$/i.test(u)) return "indeks";
  return u;
}

export function isValidPdfChartImage(dataUrl?: string | null): boolean {
  return typeof dataUrl === "string" && dataUrl.startsWith("data:image/") && dataUrl.length > 200;
}
