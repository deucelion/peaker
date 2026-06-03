import type { jsPDF } from "jspdf";

const FONT_FILE = "NotoSans-Regular.ttf";
const FONT_NAME = "NotoSans";

let fontBase64Cache: string | null = null;
let fontLoadPromise: Promise<string> | null = null;

async function loadFontBase64(): Promise<string> {
  if (fontBase64Cache) return fontBase64Cache;
  if (!fontLoadPromise) {
    fontLoadPromise = fetch("/fonts/NotoSans-Regular.ttf")
      .then((res) => {
        if (!res.ok) throw new Error("Font yuklenemedi");
        return res.arrayBuffer();
      })
      .then((buf) => {
        const bytes = new Uint8Array(buf);
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

export async function ensurePdfTurkishFont(doc: jsPDF): Promise<boolean> {
  const base64 = await loadFontBase64();
  if (!base64) return false;
  const list = doc.getFontList();
  if (!list[FONT_NAME]) {
    doc.addFileToVFS(FONT_FILE, base64);
    doc.addFont(FONT_FILE, FONT_NAME, "normal");
    doc.addFont(FONT_FILE, FONT_NAME, "bold");
  }
  doc.setFont(FONT_NAME, "normal");
  return true;
}

export async function createPdfDocument(orientation: "p" | "l" = "p"): Promise<{ doc: jsPDF; turkish: boolean }> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const turkish = await ensurePdfTurkishFont(doc);
  return { doc, turkish };
}
