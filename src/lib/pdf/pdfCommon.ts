import type { jsPDF } from "jspdf";

/** jsPDF Helvetica icin ASCII fallback. */
export function pdfSafeTr(text: string): string {
  return text
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "G")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "U")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "S")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "O")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "C");
}

export type PdfTextContext = { turkish: boolean };

export function pdfT(text: string, ctx: PdfTextContext): string {
  return ctx.turkish ? text : pdfSafeTr(text);
}

export function pdfSetFont(doc: jsPDF, ctx: PdfTextContext, style: "normal" | "bold" = "normal"): void {
  doc.setFont(ctx.turkish ? "NotoSans" : "helvetica", style);
}

export type PdfBrandOptions = {
  orgName?: string;
  reportTitle: string;
  subtitle?: string;
  logoDataUrl?: string | null;
};

const MARGIN = 14;
const FOOTER_H = 10;
const BRAND_COLOR: [number, number, number] = [124, 58, 237];

export function drawReportHeader(doc: jsPDF, opts: PdfBrandOptions, ctx: PdfTextContext): number {
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  pdfSetFont(doc, ctx, "bold");
  if (opts.logoDataUrl) {
    try {
      doc.addImage(opts.logoDataUrl, "PNG", MARGIN, 4, 14, 14);
      doc.text(pdfT(opts.orgName || "PEAKER", ctx), MARGIN + 17, 10);
    } catch {
      doc.text(pdfT(opts.orgName || "PEAKER", ctx), MARGIN, 10);
    }
  } else {
    doc.text(pdfT(opts.orgName || "PEAKER", ctx), MARGIN, 10);
  }
  doc.setFontSize(11);
  doc.text(pdfT(opts.reportTitle, ctx), MARGIN, 17);
  doc.setTextColor(40, 40, 40);
  pdfSetFont(doc, ctx, "normal");
  doc.setFontSize(9);
  let y = 28;
  if (opts.subtitle) {
    doc.text(pdfT(opts.subtitle, ctx), MARGIN, y);
    y += 5;
  }
  const created = new Date().toLocaleString("tr-TR");
  doc.setTextColor(120, 120, 120);
  doc.text(pdfT(`Oluşturulma: ${created}`, ctx), MARGIN, y);
  return y + 8;
}

export function ensureSpace(doc: jsPDF, y: number, need: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + need > pageH - FOOTER_H - MARGIN) {
    doc.addPage();
    return MARGIN + 4;
  }
  return y;
}

export function drawSectionTitle(doc: jsPDF, y: number, title: string, ctx: PdfTextContext): number {
  y = ensureSpace(doc, y, 12);
  pdfSetFont(doc, ctx, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BRAND_COLOR);
  doc.text(pdfT(title, ctx), MARGIN, y);
  doc.setDrawColor(220, 220, 220);
  doc.line(MARGIN, y + 2, doc.internal.pageSize.getWidth() - MARGIN, y + 2);
  doc.setTextColor(40, 40, 40);
  pdfSetFont(doc, ctx, "normal");
  return y + 8;
}

export function drawKeyValueRows(
  doc: jsPDF,
  y: number,
  rows: Array<{ label: string; value: string }>,
  ctx: PdfTextContext
): number {
  doc.setFontSize(9);
  for (const row of rows) {
    y = ensureSpace(doc, y, 6);
    pdfSetFont(doc, ctx, "bold");
    doc.text(pdfT(`${row.label}:`, ctx), MARGIN, y);
    pdfSetFont(doc, ctx, "normal");
    const labelW = 42;
    doc.text(pdfT(row.value, ctx), MARGIN + labelW, y, {
      maxWidth: doc.internal.pageSize.getWidth() - MARGIN * 2 - labelW,
    });
    y += 5.5;
  }
  return y + 2;
}

export function applyFootersToAllPages(
  doc: jsPDF,
  ctx: PdfTextContext,
  footerLabel = "Peaker Raporu"
): void {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    doc.setDrawColor(230, 230, 230);
    doc.line(MARGIN, pageH - FOOTER_H - 2, pageW - MARGIN, pageH - FOOTER_H - 2);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    pdfSetFont(doc, ctx, "normal");
    doc.text(pdfT(footerLabel, ctx), MARGIN, pageH - 5);
    doc.text(`${i} / ${total}`, pageW - MARGIN, pageH - 5, { align: "right" });
  }
}

export function pdfToBytes(doc: jsPDF): Uint8Array {
  const buf = doc.output("arraybuffer");
  return new Uint8Array(buf);
}

export {
  downloadPdfBytes,
  pdfDownloadUserMessage,
  type PdfDownloadOutcome,
} from "@/lib/pdf/pdfDownload";

export type ChartPoint = { x: number; y: number };

export function drawMultilineText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  ctx: PdfTextContext,
  lineHeight = 4.5
): number {
  const lines = doc.splitTextToSize(pdfT(text, ctx), maxWidth) as string[];
  for (const line of lines) {
    y = ensureSpace(doc, y, lineHeight);
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

export function drawPdfEmptyNotice(doc: jsPDF, y: number, message: string, ctx: PdfTextContext): number {
  y = ensureSpace(doc, y, 10);
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  pdfSetFont(doc, ctx, "normal");
  doc.text(pdfT(message, ctx), MARGIN, y, {
    maxWidth: doc.internal.pageSize.getWidth() - MARGIN * 2,
  });
  return y + 8;
}

export function drawEmbeddedChartImage(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  dataUrl: string,
  ctx: PdfTextContext
): number {
  y = ensureSpace(doc, y, h);
  try {
    if (!dataUrl.startsWith("data:image/")) throw new Error("invalid chart");
    doc.addImage(dataUrl, "PNG", x, y, w, h);
  } catch {
    pdfSetFont(doc, ctx, "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(pdfT("Grafik eklenemedi — yeterli veri olmayabilir.", ctx), x, y + 4);
    return y + 10;
  }
  return y + h + 6;
}

export function downsampleChartPoints<T>(items: T[], maxPoints = 60): T[] {
  if (items.length <= maxPoints) return items;
  const step = items.length / maxPoints;
  const out: T[] = [];
  for (let i = 0; i < maxPoints; i += 1) {
    out.push(items[Math.min(items.length - 1, Math.floor(i * step))]!);
  }
  if (out[out.length - 1] !== items[items.length - 1]) {
    out.push(items[items.length - 1]!);
  }
  return out;
}

export async function runPdfTask<T>(task: () => T | Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      Promise.resolve(task()).then(resolve).catch(reject);
    }, 0);
  });
}

export function drawSimpleLineChart(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  series: Array<{ label: string; color: [number, number, number]; points: ChartPoint[] }>,
  ctx: PdfTextContext,
  opts?: { optimalBand?: [number, number] }
): number {
  pdfSetFont(doc, ctx, "bold");
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  doc.text(pdfT(title, ctx), x, y);
  y += 3;
  doc.setDrawColor(220, 220, 220);
  doc.rect(x, y, w, h);

  const allY = series.flatMap((s) => s.points.map((p) => p.y));
  const minY = allY.length ? Math.min(...allY) : 0;
  const maxY = allY.length ? Math.max(...allY) : 1;
  const span = maxY - minY || 1;
  const py = (val: number) => y + h - 4 - ((val - minY) / span) * (h - 8);

  if (opts?.optimalBand) {
    const [lo, hi] = opts.optimalBand;
    const yLo = py(lo);
    const yHi = py(hi);
    const top = Math.min(yLo, yHi);
    const bandH = Math.abs(yHi - yLo);
    doc.setFillColor(220, 252, 231);
    doc.rect(x + 1, top, w - 2, bandH, "F");
    doc.setDrawColor(220, 220, 220);
    doc.rect(x, y, w, h);
  }

  for (const s of series) {
    if (s.points.length < 2) continue;
    doc.setDrawColor(...s.color);
    const px = (i: number, n: number) => x + 4 + (i / Math.max(1, n - 1)) * (w - 8);
    for (let i = 1; i < s.points.length; i += 1) {
      const a = s.points[i - 1]!;
      const b = s.points[i]!;
      doc.line(px(i - 1, s.points.length), py(a.y), px(i, s.points.length), py(b.y));
    }
  }

  pdfSetFont(doc, ctx, "normal");
  doc.setFontSize(6);
  doc.setTextColor(140, 140, 140);
  doc.text(minY.toFixed(2), x + 2, y + h - 1);
  doc.text(maxY.toFixed(2), x + 2, y + 3);
  if (opts?.optimalBand) {
    doc.setTextColor(34, 130, 80);
    doc.text(pdfT(`Optimal ${opts.optimalBand[0]}–${opts.optimalBand[1]}`, ctx), x + w - 38, y + 3);
  }

  return y + h + 6;
}
