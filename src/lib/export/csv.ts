/**
 * Faz 4.6 — Minimal CSV builder.
 *
 * Hedef:
 *   - UTF-8 BOM (Excel TR uyumu).
 *   - ; (noktalı virgül) separator (Excel TR varsayılanı).
 *   - Çift tırnak escape kuralı (RFC 4180 benzeri).
 *   - Yeni satır: \r\n (Excel uyumu).
 *
 * Kullanım:
 *   const csv = buildCsv(["A", "B"], rows.map((r) => [r.id, r.name]));
 *   const filename = csvFilename("muhasebe", "tahsilat", { month });
 */

const BOM = "\uFEFF";

/**
 * Tek hücreyi CSV-safe string'e çevirir.
 * - null/undefined → boş hücre
 * - number → toFixed yapılmaz; sayısal değer Excel'de doğru hücre tipinde açılır
 * - string → ; veya " içeriyorsa çift tırnak ile sarılır, içerideki " ikilenir
 * - boolean → "true"/"false" (yerel dile çevirmiyoruz; Excel beklenen format).
 * - Date → ISO 8601 (server-side daha güvenli)
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) {
    const t = value.getTime();
    if (!Number.isFinite(t)) return "";
    return value.toISOString();
  }
  let s = String(value);
  // Excel'de "=" ile başlayan formül enjeksiyonu: ' ile prefix ekleyerek nötrle.
  if (s.length > 0 && (s[0] === "=" || s[0] === "+" || s[0] === "-" || s[0] === "@")) {
    s = `'${s}`;
  }
  if (s.includes(";") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsv(headers: string[], rows: ReadonlyArray<ReadonlyArray<unknown>>): string {
  const headerLine = headers.map(csvCell).join(";");
  const bodyLines = rows.map((row) => row.map(csvCell).join(";"));
  return BOM + [headerLine, ...bodyLines].join("\r\n") + "\r\n";
}

/** Dosya adı; pathlerde güvenli olacak şekilde sanitize. */
export function csvFilename(scope: string, subscope: string, extras: Record<string, string | null | undefined> = {}): string {
  const safe = (v: string) =>
    v
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const parts = [safe(scope), safe(subscope)];
  for (const [k, v] of Object.entries(extras)) {
    if (!v) continue;
    parts.push(`${safe(k)}-${safe(v)}`);
  }
  const today = new Date();
  const stamp = `${today.getUTCFullYear()}${String(today.getUTCMonth() + 1).padStart(2, "0")}${String(today.getUTCDate()).padStart(2, "0")}`;
  parts.push(stamp);
  return `${parts.filter(Boolean).join("_")}.csv`;
}
