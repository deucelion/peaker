/**
 * E-posta lookup ve form dogrulamasi icin ortak normalizasyon.
 * TR klavye varyantlari ve bosluklar icin tutarli anahtar uretir.
 */

export const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmailInput(value: string | null | undefined): string {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}
