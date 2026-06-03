import type { jsPDF } from "jspdf";
import type { AcwrRiskLevel } from "@/lib/performance/acwrInsights";
import {
  ensureSpace,
  pdfSetFont,
  pdfT,
  type PdfTextContext,
} from "@/lib/pdf/pdfCommon";

const MARGIN = 14;

export const PDF_RISK_RGB: Record<AcwrRiskLevel, [number, number, number]> = {
  low: [59, 130, 246],
  optimal: [34, 197, 94],
  caution: [245, 158, 11],
  high: [239, 68, 68],
  nodata: [156, 163, 175],
};

export type PdfKpiCard = {
  label: string;
  value: string;
  accent?: [number, number, number];
};

/** Üst özet şeridi — risk, ACWR/EWMA ve tek cümle durum. */
export function drawAtAGlanceBanner(
  doc: jsPDF,
  y: number,
  opts: {
    riskLabel: string;
    riskLevel: AcwrRiskLevel;
    acwrText: string;
    ewmaText: string;
    summary: string;
  },
  ctx: PdfTextContext
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const boxH = 30;
  y = ensureSpace(doc, y, boxH + 4);
  const rgb = PDF_RISK_RGB[opts.riskLevel];

  doc.setFillColor(248, 247, 255);
  doc.setDrawColor(225, 220, 245);
  doc.roundedRect(MARGIN, y, pageW - MARGIN * 2, boxH, 3, 3, "FD");
  doc.setFillColor(...rgb);
  doc.rect(MARGIN, y, 3.5, boxH, "F");

  pdfSetFont(doc, ctx, "bold");
  doc.setFontSize(7);
  doc.setTextColor(110, 110, 120);
  doc.text(pdfT("TEK BAKIŞ", ctx), MARGIN + 7, y + 5.5);

  doc.setFillColor(...rgb);
  doc.roundedRect(MARGIN + 7, y + 8, 32, 8, 2, 2, "F");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(pdfT(opts.riskLabel, ctx), MARGIN + 9, y + 13.5);

  pdfSetFont(doc, ctx, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(50, 50, 50);
  const summaryLines = doc.splitTextToSize(pdfT(opts.summary, ctx), pageW - MARGIN * 2 - 52) as string[];
  doc.text(summaryLines.slice(0, 2), MARGIN + 7, y + 21);

  pdfSetFont(doc, ctx, "bold");
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text(`ACWR ${opts.acwrText}`, pageW - MARGIN - 42, y + 12);
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  pdfSetFont(doc, ctx, "normal");
  doc.text(`EWMA ${opts.ewmaText}`, pageW - MARGIN - 42, y + 18);

  return y + boxH + 7;
}

/** Yatay KPI kartları (2–4 adet). */
export function drawKpiCardRow(doc: jsPDF, y: number, cards: PdfKpiCard[], ctx: PdfTextContext): number {
  if (cards.length === 0) return y;
  const pageW = doc.internal.pageSize.getWidth();
  const gap = 3;
  const cardH = 17;
  const cardW = (pageW - MARGIN * 2 - gap * (cards.length - 1)) / cards.length;
  y = ensureSpace(doc, y, cardH + 5);

  let x = MARGIN;
  for (const card of cards) {
    doc.setFillColor(252, 252, 254);
    doc.setDrawColor(228, 228, 235);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, "FD");
    if (card.accent) {
      doc.setFillColor(...card.accent);
      doc.rect(x, y, 2.5, cardH, "F");
    }
    pdfSetFont(doc, ctx, "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(130, 130, 140);
    doc.text(pdfT(card.label.toUpperCase(), ctx), x + 4, y + 5);
    pdfSetFont(doc, ctx, "bold");
    doc.setFontSize(11);
    doc.setTextColor(25, 25, 30);
    doc.text(pdfT(card.value, ctx), x + 4, y + 12.5);
    x += cardW + gap;
  }
  return y + cardH + 7;
}

/** Koç önerisi / genel not vurgu kutusu. */
export function drawHighlightCallout(
  doc: jsPDF,
  y: number,
  title: string,
  body: string,
  ctx: PdfTextContext,
  accent: [number, number, number] = [124, 58, 237]
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - MARGIN * 2 - 10;
  pdfSetFont(doc, ctx, "normal");
  doc.setFontSize(9);
  const bodyLines = doc.splitTextToSize(pdfT(body, ctx), maxW) as string[];
  const boxH = 10 + bodyLines.length * 4.5;
  y = ensureSpace(doc, y, boxH + 4);

  doc.setFillColor(252, 250, 255);
  doc.setDrawColor(225, 215, 250);
  doc.roundedRect(MARGIN, y, pageW - MARGIN * 2, boxH, 2, 2, "FD");
  doc.setFillColor(...accent);
  doc.rect(MARGIN, y, 3, boxH, "F");

  pdfSetFont(doc, ctx, "bold");
  doc.setFontSize(8);
  doc.setTextColor(...accent);
  doc.text(pdfT(title, ctx), MARGIN + 6, y + 5.5);
  pdfSetFont(doc, ctx, "normal");
  doc.setFontSize(9);
  doc.setTextColor(55, 55, 60);
  doc.text(bodyLines, MARGIN + 6, y + 11);
  return y + boxH + 6;
}

/** Küçük bilgi etiketleri (test sayısı, boy/kilo vb.). */
export function drawInfoChipRow(doc: jsPDF, y: number, chips: string[], ctx: PdfTextContext): number {
  if (chips.length === 0) return y;
  y = ensureSpace(doc, y, 10);
  let x = MARGIN;
  pdfSetFont(doc, ctx, "bold");
  doc.setFontSize(7);
  for (const chip of chips) {
    const w = doc.getTextWidth(pdfT(chip, ctx)) + 8;
    doc.setFillColor(241, 238, 255);
    doc.setDrawColor(210, 200, 245);
    doc.roundedRect(x, y, w, 7, 2, 2, "FD");
    doc.setTextColor(90, 70, 160);
    doc.text(pdfT(chip, ctx), x + 4, y + 5);
    x += w + 3;
    if (x > doc.internal.pageSize.getWidth() - MARGIN - 20) break;
  }
  doc.setTextColor(40, 40, 40);
  pdfSetFont(doc, ctx, "normal");
  return y + 10;
}

/** Tablo başlık çubuğu (gri arka plan). */
export function drawTableHeaderBar(
  doc: jsPDF,
  y: number,
  columns: string[],
  colWidths: number[],
  ctx: PdfTextContext
): number {
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  y = ensureSpace(doc, y, 8);
  doc.setFillColor(240, 240, 245);
  doc.rect(MARGIN, y - 3, totalW, 8, "F");
  pdfSetFont(doc, ctx, "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(70, 70, 80);
  let x = MARGIN + 2;
  for (let i = 0; i < columns.length; i += 1) {
    doc.text(pdfT(columns[i]!, ctx), x, y + 2);
    x += colWidths[i]!;
  }
  pdfSetFont(doc, ctx, "normal");
  return y + 6;
}

/** Kıyas özeti: gelişen / gerileyen / sabit sayıları. */
export function drawComparisonSummary(
  doc: jsPDF,
  y: number,
  counts: { improved: number; regressed: number; unchanged: number },
  ctx: PdfTextContext
): number {
  return drawKpiCardRow(
    doc,
    y,
    [
      { label: "Gelişen", value: String(counts.improved), accent: [34, 197, 94] },
      { label: "Gerileyen", value: String(counts.regressed), accent: [239, 68, 68] },
      { label: "Değişmeyen", value: String(counts.unchanged), accent: [156, 163, 175] },
    ],
    ctx
  );
}

/** Değerlendirme notu kartı. */
export function drawNoteCard(
  doc: jsPDF,
  y: number,
  title: string,
  body: string,
  ctx: PdfTextContext
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - MARGIN * 2 - 10;
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(pdfT(body, ctx), maxW) as string[];
  const boxH = 9 + lines.length * 4.5;
  y = ensureSpace(doc, y, boxH + 3);

  doc.setFillColor(252, 252, 254);
  doc.setDrawColor(230, 230, 235);
  doc.roundedRect(MARGIN, y, pageW - MARGIN * 2, boxH, 2, 2, "FD");
  doc.setFillColor(124, 58, 237);
  doc.rect(MARGIN, y, 2, boxH, "F");

  pdfSetFont(doc, ctx, "bold");
  doc.setFontSize(8);
  doc.setTextColor(40, 40, 40);
  doc.text(pdfT(title, ctx), MARGIN + 5, y + 5);
  pdfSetFont(doc, ctx, "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(70, 70, 75);
  doc.text(lines, MARGIN + 5, y + 10);
  return y + boxH + 4;
}

export function formatAcwrDisplay(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return "—";
  return ratio.toFixed(2);
}

export function formatEwmaDisplay(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return "—";
  return ratio.toFixed(2);
}

export { MARGIN as PDF_LAYOUT_MARGIN };
