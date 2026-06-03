import { createPdfDocument } from "@/lib/pdf/pdfFont";
import { pdfFilenameSlug, ensurePdfExtension } from "@/lib/pdf/pdfFilename";
import { formatPdfMetricUnit, formatPdfPersonName } from "@/lib/pdf/pdfFormat";
import {
  drawHighlightCallout,
  drawInfoChipRow,
  drawKpiCardRow,
  drawNoteCard,
  drawTableHeaderBar,
  PDF_LAYOUT_MARGIN,
} from "@/lib/pdf/pdfLayout";
import {
  applyFootersToAllPages,
  drawReportHeader,
  drawSectionTitle,
  ensureSpace,
  pdfT,
  pdfToBytes,
  type PdfTextContext,
} from "@/lib/pdf/pdfCommon";

export type FieldTestAthleteInfo = {
  fullName: string;
  testDate: string;
  age?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
};

export type FieldTestMetricEntry = {
  name: string;
  category?: string | null;
  unit?: string | null;
  value: string;
};

export type FieldTestSingleDatePdfInput = {
  orgName?: string;
  athlete: FieldTestAthleteInfo;
  numericMetrics: FieldTestMetricEntry[];
  textMetrics: FieldTestMetricEntry[];
  generalNote?: string | null;
  logoDataUrl?: string | null;
};

const FIELD_TEST_FOOTER = "Peaker Saha Testi Raporu";
const MARGIN = PDF_LAYOUT_MARGIN;

function formatTrDate(isoDate: string): string {
  try {
    return new Date(`${isoDate}T12:00:00`).toLocaleDateString("tr-TR", { dateStyle: "long" });
  } catch {
    return isoDate;
  }
}

function groupByCategory(metrics: FieldTestMetricEntry[]): Array<[string, FieldTestMetricEntry[]]> {
  const map = new Map<string, FieldTestMetricEntry[]>();
  for (const m of metrics) {
    const cat = m.category?.trim() || "Genel";
    const list = map.get(cat) || [];
    list.push(m);
    map.set(cat, list);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "tr"));
}

function pdfSetFontLocal(
  doc: Awaited<ReturnType<typeof createPdfDocument>>["doc"],
  ctx: PdfTextContext,
  style: "normal" | "bold"
): void {
  doc.setFont(ctx.turkish ? "NotoSans" : "helvetica", style);
}

function drawCategoryLabel(
  doc: Awaited<ReturnType<typeof createPdfDocument>>["doc"],
  y: number,
  category: string,
  count: number,
  ctx: PdfTextContext
): number {
  y = ensureSpace(doc, y, 9);
  pdfSetFontLocal(doc, ctx, "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(124, 58, 237);
  doc.text(pdfT(`${category} (${count})`, ctx), MARGIN, y);
  doc.setTextColor(40, 40, 40);
  pdfSetFontLocal(doc, ctx, "normal");
  return y + 5;
}

function drawNumericMetricRows(
  doc: Awaited<ReturnType<typeof createPdfDocument>>["doc"],
  y: number,
  metrics: FieldTestMetricEntry[],
  colW: number[],
  ctx: PdfTextContext,
  onNewPage: (atY: number) => number
): number {
  doc.setFontSize(8.5);
  for (let i = 0; i < metrics.length; i += 1) {
    const m = metrics[i]!;
    const unitLabel = formatPdfMetricUnit(m.name, m.unit);
    const valueLines = doc.splitTextToSize(m.value || "—", colW[1]! - 2) as string[];
    const rowH = Math.max(6.5, valueLines.length * 4.5 + 1);
    const prevY = y;
    y = ensureSpace(doc, y, rowH + 1);
    if (y < prevY - 1) {
      y = onNewPage(y);
    }

    if (i % 2 === 0) {
      doc.setFillColor(252, 252, 254);
      doc.rect(MARGIN, y - 1, colW[0]! + colW[1]! + colW[2]!, rowH + 1, "F");
    }

    pdfSetFontLocal(doc, ctx, "bold");
    doc.setTextColor(35, 35, 40);
    doc.text(pdfT(m.name, ctx), MARGIN + 2, y + 4, { maxWidth: colW[0]! - 4 });
    pdfSetFontLocal(doc, ctx, "normal");
    doc.setFontSize(9);
    doc.setTextColor(20, 20, 25);
    doc.text(valueLines, MARGIN + colW[0]! + 2, y + 4);
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 115);
    doc.text(pdfT(unitLabel, ctx), MARGIN + colW[0]! + colW[1]! + 2, y + 4, { maxWidth: colW[2]! - 2 });
    y += rowH;
  }
  return y + 2;
}

function drawGroupedNumericTable(
  doc: Awaited<ReturnType<typeof createPdfDocument>>["doc"],
  y: number,
  metrics: FieldTestMetricEntry[],
  ctx: PdfTextContext
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const colW = [(pageW - 28) * 0.46, (pageW - 28) * 0.28, (pageW - 28) * 0.26];
  const groups = groupByCategory(metrics);
  const columns = ["Metrik", "Sonuç", "Birim"];

  y = drawTableHeaderBar(doc, y, columns, colW, ctx);

  for (const [category, items] of groups) {
    y = drawCategoryLabel(doc, y, category, items.length, ctx);
    y = drawNumericMetricRows(doc, y, items, colW, ctx, (atY) =>
      drawTableHeaderBar(doc, atY, columns, colW, ctx)
    );
  }
  return y;
}

export async function buildFieldTestSingleDatePdf(input: FieldTestSingleDatePdfInput): Promise<Uint8Array> {
  const { doc, turkish } = await createPdfDocument("p");
  const ctx: PdfTextContext = { turkish };
  const displayName = formatPdfPersonName(input.athlete.fullName);
  const dateLabel = formatTrDate(input.athlete.testDate);
  const categories = groupByCategory(input.numericMetrics);

  let y = drawReportHeader(
    doc,
    {
      orgName: input.orgName,
      reportTitle: "Saha Testi Raporu",
      subtitle: `${displayName} · ${dateLabel}`,
      logoDataUrl: input.logoDataUrl,
    },
    ctx
  );

  const chips: string[] = [];
  if (input.numericMetrics.length > 0) chips.push(`${input.numericMetrics.length} sayısal test`);
  if (input.textMetrics.length > 0) chips.push(`${input.textMetrics.length} değerlendirme`);
  if (input.athlete.heightCm != null) chips.push(`${input.athlete.heightCm} cm`);
  if (input.athlete.weightKg != null) chips.push(`${input.athlete.weightKg} kg`);
  y = drawInfoChipRow(doc, y, chips, ctx);

  y = drawKpiCardRow(
    doc,
    y,
    [
      { label: "Test tarihi", value: dateLabel.split(" ").slice(0, 2).join(" ") },
      { label: "Sayısal", value: String(input.numericMetrics.length) },
      { label: "Değerlendirme", value: String(input.textMetrics.length) },
      { label: "Kategori", value: String(categories.length) },
    ],
    ctx
  );

  if (input.numericMetrics.length > 0) {
    y = drawSectionTitle(doc, y, "Sayısal Test Sonuçları", ctx);
    y = drawGroupedNumericTable(doc, y, input.numericMetrics, ctx);
  }

  if (input.textMetrics.length > 0) {
    y = drawSectionTitle(doc, y, "Değerlendirme Notları", ctx);
    for (const m of input.textMetrics) {
      y = drawNoteCard(doc, y, m.name, m.value || "—", ctx);
    }
  }

  if (input.generalNote?.trim()) {
    y = drawHighlightCallout(
      doc,
      y,
      "Genel not",
      input.generalNote.trim(),
      ctx,
      [245, 158, 11]
    );
  }

  if (input.numericMetrics.length === 0 && input.textMetrics.length === 0) {
    y = drawSectionTitle(doc, y, "Test Sonuçları", ctx);
    y = drawNoteCard(doc, y, "Veri yok", "Bu tarihte kayıtlı test değeri bulunmuyor.", ctx);
  }

  applyFootersToAllPages(doc, ctx, FIELD_TEST_FOOTER);
  return pdfToBytes(doc);
}

export function fieldTestSingleDatePdfFilename(athleteName: string, testDate: string): string {
  return ensurePdfExtension(`saha-testi_${pdfFilenameSlug(athleteName)}_${testDate}`);
}
