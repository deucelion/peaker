import type { jsPDF } from "jspdf";

const FONT_FILE = "NotoSans-Regular.ttf";
const FONT_NAME = "NotoSans";

let fontBase64Cache: string | null = null;
let fontLoadPromise: Promise<string> | null = null;

/**
 * sfnt (TrueType/OpenType) imzası.
 *
 * `fetch` başarılı (`res.ok`) dönse bile gövde font olmayabilir: auth/edge
 * redirect'i HTML döndürebilir, proxy hata sayfası basabilir ya da mobil
 * bağlantıda gövde yarım gelebilir. Böyle bir gövde jsPDF'e font diye verilirse
 * font nesnesi `metadata.Unicode` olmadan kaydolur ve ilk metin ölçümünde
 * "Cannot read properties of undefined (reading 'widths')" ile PDF üretimi çöker.
 */
export function isSupportedPdfFontBinary(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  const tag =
    ((bytes[0]! << 24) >>> 0) + (bytes[1]! << 16) + (bytes[2]! << 8) + bytes[3]!;
  return (
    tag === 0x00010000 || // TrueType
    tag === 0x74727565 || // "true"
    tag === 0x74746366 || // "ttcf"
    tag === 0x4f54544f // "OTTO"
  );
}

async function loadFontBase64(): Promise<string> {
  if (fontBase64Cache) return fontBase64Cache;
  if (!fontLoadPromise) {
    fontLoadPromise = fetch("/fonts/NotoSans-Regular.ttf")
      .then(async (res) => {
        if (!res.ok) throw new Error("Font yuklenemedi");
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (!isSupportedPdfFontBinary(bytes)) {
          throw new Error("Font yaniti gecerli bir TTF degil");
        }
        let binary = "";
        for (let i = 0; i < bytes.length; i += 1) {
          binary += String.fromCharCode(bytes[i]!);
        }
        fontBase64Cache = btoa(binary);
        return fontBase64Cache;
      })
      .catch(() => {
        fontLoadPromise = null;
        return "";
      });
  }
  return fontLoadPromise;
}

/** Metin ölçümü gerçekten çalışıyor mu — kayıtlı font bozuksa burada yakalanır. */
function canMeasureTextWithActiveFont(doc: jsPDF): boolean {
  try {
    doc.getTextWidth("Ağ");
    doc.splitTextToSize("Ağırlık ölçümü", 40);
    return true;
  } catch {
    return false;
  }
}

function fallbackToHelvetica(doc: jsPDF): false {
  try {
    doc.setFont("helvetica", "normal");
  } catch {
    /* jsPDF her zaman helvetica ile gelir; yine de PDF üretimini bloklamayalim. */
  }
  return false;
}

/**
 * Türkçe font kaydını dener. Font yüklenemez ya da kaydedilen font kullanılamaz
 * durumdaysa `false` döner ve çağıran ASCII-fallback (helvetica) ile devam eder.
 */
export async function ensurePdfTurkishFont(doc: jsPDF): Promise<boolean> {
  const base64 = await loadFontBase64();
  if (!base64) return fallbackToHelvetica(doc);

  try {
    doc.addFileToVFS(FONT_FILE, base64);
    doc.addFont(FONT_FILE, FONT_NAME, "normal");
    doc.addFont(FONT_FILE, FONT_NAME, "bold");
    doc.setFont(FONT_NAME, "normal");
  } catch {
    return fallbackToHelvetica(doc);
  }

  if (!canMeasureTextWithActiveFont(doc)) {
    return fallbackToHelvetica(doc);
  }
  return true;
}

export async function createPdfDocument(orientation: "p" | "l" = "p"): Promise<{ doc: jsPDF; turkish: boolean }> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const turkish = await ensurePdfTurkishFont(doc);
  return { doc, turkish };
}

/** Test-only — modül seviyesi font önbelleğini sıfırlar. */
export function resetPdfFontCacheForTests(): void {
  fontBase64Cache = null;
  fontLoadPromise = null;
}
