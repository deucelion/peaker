/** Faz 16 — Audit list/export tarih aralığı (gün sonu dahil). */

export function auditDateStartIso(key: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return `${key}T00:00:00.000Z`;
  return new Date(key).toISOString();
}

export function auditDateEndIso(key: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return `${key}T23:59:59.999Z`;
  return new Date(key).toISOString();
}
