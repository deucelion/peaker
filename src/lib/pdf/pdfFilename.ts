/** PDF dosya adlari icin guvenli slug (Turkce karakterler ASCII'ye). */
export function pdfFilenameSlug(input: string, maxLen = 48): string {
  const slug = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ğ/gi, "g")
    .replace(/ü/gi, "u")
    .replace(/ş/gi, "s")
    .replace(/ı/gi, "i")
    .replace(/ö/gi, "o")
    .replace(/ç/gi, "c")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen);
  return slug || "rapor";
}

export function ensurePdfExtension(name: string): string {
  return name.endsWith(".pdf") ? name : `${name}.pdf`;
}
