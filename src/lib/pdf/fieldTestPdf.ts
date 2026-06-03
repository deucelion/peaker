import { createPdfDocument } from "@/lib/pdf/pdfFont";
import { pdfFilenameSlug, ensurePdfExtension } from "@/lib/pdf/pdfFilename";
import {
  applyFootersToAllPages,
  drawKeyValueRows,
  drawMultilineText,
  drawReportHeader,
  drawSectionTitle,
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

function formatTrDate(isoDate: string): string {
  try {
    return new Date(`${isoDate}T12:00:00`).toLocaleDateString("tr-TR", { dateStyle: "long" });
  } catch {
    return isoDate;
  }
}

function drawMetricTable(
  doc: Awaited<ReturnType<typeof createPdfDocument>>["doc"],
  y: number,
  metrics: FieldTestMetricEntry[],
  ctx: PdfTextContext
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const colW = [(pageW - 28) * 0.45, (pageW - 28) * 0.2, (pageW - 28) * 0.35];
  doc.setFontSize(8);
  doc.setFont(ctx.turkish ? "NotoSans" : "helvetica", "bold");
  y += 2;
  doc.text("Metrik", 14, y);
  doc.text("Değer", 14 + colW[0]!, y);
  doc.text("Birim / Kategori", 14 + colW[0]! + colW[1]!, y);
  y += 5;
  doc.setFont(ctx.turkish ? "NotoSans" : "helvetica", "normal");
  for (const m of metrics) {
    const valueLines = doc.splitTextToSize(m.value || "—", colW[1]! - 2) as string[];
    const meta = [m.unit, m.category].filter(Boolean).join(" · ") || "—";
    const rowH = Math.max(5, valueLines.length * 4.5);
    y += rowH;
    doc.text(m.name, 14, y - rowH + 4, { maxWidth: colW[0]! - 2 });
    doc.text(valueLines, 14 + colW[0]!, y - rowH + 4);
    doc.text(meta, 14 + colW[0]! + colW[1]!, y - rowH + 4, { maxWidth: colW[2]! - 2 });
  }
  return y + 3;
}

export async function buildFieldTestSingleDatePdf(input: FieldTestSingleDatePdfInput): Promise<Uint8Array> {
  const { doc, turkish } = await createPdfDocument("p");
  const ctx: PdfTextContext = { turkish };

  let y = drawReportHeader(
    doc,
    {
      orgName: input.orgName,
      reportTitle: "Saha Testi Raporu",
      subtitle: `Tek tarih — ${formatTrDate(input.athlete.testDate)}`,
      logoDataUrl: input.logoDataUrl,
    },
    ctx
  );

  y = drawSectionTitle(doc, y, "Sporcu Bilgisi", ctx);
  y = drawKeyValueRows(
    doc,
    y,
    [
      { label: "Ad Soyad", value: input.athlete.fullName },
      { label: "Test Tarihi", value: formatTrDate(input.athlete.testDate) },
      { label: "Yaş", value: input.athlete.age?.trim() || "—" },
      { label: "Boy", value: input.athlete.heightCm != null ? `${input.athlete.heightCm} cm` : "—" },
      { label: "Kilo", value: input.athlete.weightKg != null ? `${input.athlete.weightKg} kg` : "—" },
    ],
    ctx
  );

  if (input.numericMetrics.length > 0) {
    y = drawSectionTitle(doc, y, "Test Sonuçları", ctx);
    y = drawMetricTable(doc, y, input.numericMetrics, ctx);
  }

  if (input.textMetrics.length > 0) {
    y = drawSectionTitle(doc, y, "Yazılı Metrikler", ctx);
    y = drawMetricTable(doc, y, input.textMetrics, ctx);
  }

  if (input.generalNote?.trim()) {
    y = drawSectionTitle(doc, y, "Genel Not", ctx);
    doc.setFontSize(9);
    drawMultilineText(doc, input.generalNote.trim(), 14, y, doc.internal.pageSize.getWidth() - 28, ctx);
  }

  if (input.numericMetrics.length === 0 && input.textMetrics.length === 0) {
    y = drawSectionTitle(doc, y, "Test Sonuçları", ctx);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    drawMultilineText(doc, "Bu tarihte kayıtlı test değeri bulunmuyor.", 14, y, doc.internal.pageSize.getWidth() - 28, ctx);
  }

  applyFootersToAllPages(doc, ctx);
  return pdfToBytes(doc);
}

export function fieldTestSingleDatePdfFilename(athleteName: string, testDate: string): string {
  return ensurePdfExtension(`saha-testi_${pdfFilenameSlug(athleteName)}_${testDate}`);
}
