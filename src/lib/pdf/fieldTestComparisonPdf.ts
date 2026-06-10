import { createPdfDocument } from "@/lib/pdf/pdfFont";
import { pdfFilenameSlug, ensurePdfExtension } from "@/lib/pdf/pdfFilename";
import {
  classifyFieldTestComparison,
  comparisonCommentTr,
  formatChangePercent,
  type ComparisonVerdict,
  type MetricImprovementDirection,
} from "@/lib/fieldTests/comparisonVerdict";
import { formatPdfPersonName } from "@/lib/pdf/pdfFormat";
import { drawComparisonSummary, drawTableHeaderBar, PDF_LAYOUT_MARGIN } from "@/lib/pdf/pdfLayout";
import {
  applyFootersToAllPages,
  drawReportHeader,
  drawSectionTitle,
  ensureSpace,
  pdfT,
  pdfToBytes,
  type PdfTextContext,
} from "@/lib/pdf/pdfCommon";

export type FieldTestComparisonRow = {
  name: string;
  unit?: string | null;
  oldDisplay: string;
  newDisplay: string;
  oldNumeric?: number | null;
  newNumeric?: number | null;
  direction: MetricImprovementDirection;
  isText?: boolean;
};

export type FieldTestComparisonPdfInput = {
  orgName?: string;
  athleteName: string;
  dateFrom: string;
  dateTo: string;
  rows: FieldTestComparisonRow[];
  logoDataUrl?: string | null;
};

function formatTrDate(isoDate: string): string {
  try {
    return new Date(`${isoDate}T12:00:00`).toLocaleDateString("tr-TR", { dateStyle: "long" });
  } catch {
    return isoDate;
  }
}

const VERDICT_RGB: Record<ComparisonVerdict, [number, number, number]> = {
  improved: [34, 197, 94],
  regressed: [239, 68, 68],
  unchanged: [156, 163, 175],
  unknown: [156, 163, 175],
};

export function buildComparisonRowsResolved(rows: FieldTestComparisonRow[]): Array<{
  name: string;
  oldDisplay: string;
  newDisplay: string;
  changePct: string | null;
  verdict: ComparisonVerdict;
  comment: string;
}> {
  return rows.map((r) => {
    const oldMissing = r.oldDisplay === "—" || r.oldDisplay.trim() === "";
    const newMissing = r.newDisplay === "—" || r.newDisplay.trim() === "";
    if (r.isText) {
      if (oldMissing && newMissing) {
        return { name: r.name, oldDisplay: "—", newDisplay: "—", changePct: null, verdict: "unknown" as ComparisonVerdict, comment: "Veri yok" };
      }
      if (oldMissing) {
        return { name: r.name, oldDisplay: "—", newDisplay: r.newDisplay, changePct: null, verdict: "unknown" as ComparisonVerdict, comment: "İlk test yok" };
      }
      if (newMissing) {
        return { name: r.name, oldDisplay: r.oldDisplay, newDisplay: "—", changePct: null, verdict: "unknown" as ComparisonVerdict, comment: "Son test yok" };
      }
      const same = r.oldDisplay.trim() === r.newDisplay.trim();
      return {
        name: r.name,
        oldDisplay: r.oldDisplay,
        newDisplay: r.newDisplay,
        changePct: null,
        verdict: same ? "unchanged" : "unknown",
        comment: same ? "Değişim yok" : "Metin güncellendi",
      };
    }
    const oldN = r.oldNumeric;
    const newN = r.newNumeric;
    if (oldMissing && newMissing) {
      return { name: r.name, oldDisplay: "—", newDisplay: "—", changePct: null, verdict: "unknown", comment: "Veri yok" };
    }
    if (oldMissing || newMissing) {
      return {
        name: r.name,
        oldDisplay: r.oldDisplay,
        newDisplay: r.newDisplay,
        changePct: null,
        verdict: "unknown",
        comment: oldMissing ? "İlk test yok" : "Son test yok",
      };
    }
    const verdict =
      typeof oldN === "number" && typeof newN === "number"
        ? classifyFieldTestComparison(r.direction, oldN, newN)
        : "unknown";
    return {
      name: r.name,
      oldDisplay: r.oldDisplay,
      newDisplay: r.newDisplay,
      changePct: typeof oldN === "number" && typeof newN === "number" ? formatChangePercent(oldN, newN) : null,
      verdict,
      comment: comparisonCommentTr(verdict),
    };
  });
}

export function filterChangedComparisonRows(rows: FieldTestComparisonRow[]): FieldTestComparisonRow[] {
  return rows.filter((r) => {
    if (r.isText) return r.oldDisplay.trim() !== r.newDisplay.trim();
    return r.oldDisplay !== r.newDisplay;
  });
}

export async function buildFieldTestComparisonPdf(input: FieldTestComparisonPdfInput): Promise<Uint8Array> {
  const { doc, turkish } = await createPdfDocument("l");
  const ctx: PdfTextContext = { turkish };
  const resolved = buildComparisonRowsResolved(input.rows);
  const displayName = formatPdfPersonName(input.athleteName);

  let y = drawReportHeader(
    doc,
    {
      orgName: input.orgName,
      reportTitle: "Saha Testi Kıyas Raporu",
      subtitle: `${displayName} · ${formatTrDate(input.dateFrom)} → ${formatTrDate(input.dateTo)}`,
      logoDataUrl: input.logoDataUrl,
    },
    ctx
  );

  const counts = resolved.reduce(
    (acc, r) => {
      if (r.verdict === "improved") acc.improved += 1;
      else if (r.verdict === "regressed") acc.regressed += 1;
      else if (r.verdict === "unchanged") acc.unchanged += 1;
      return acc;
    },
    { improved: 0, regressed: 0, unchanged: 0 }
  );
  y = drawComparisonSummary(doc, y, counts, ctx);

  y = drawSectionTitle(doc, y, "Metrik Kıyas Tablosu", ctx);
  const startX = PDF_LAYOUT_MARGIN;
  const pageW = doc.internal.pageSize.getWidth();
  const tableW = pageW - startX * 2;
  const colMetric = tableW * 0.16;
  const colOld = tableW * 0.24;
  const colNew = tableW * 0.24;
  const colChange = tableW * 0.1;
  const colComment = tableW - colMetric - colOld - colNew - colChange;
  const colWidths = [colMetric, colOld, colNew, colChange, colComment];
  const headerLabels = ["Metrik", "Eski", "Yeni", "Değişim", "Yorum"];
  const LINE_H = 4.5;
  const ROW_PAD = 3.5;

  const cellLines = (text: string, maxW: number): string[] => {
    const lines = doc.splitTextToSize(pdfT(text, ctx), Math.max(maxW, 8)) as string[];
    return lines.length > 0 ? lines : ["—"];
  };

  const drawHeader = (atY: number) => drawTableHeaderBar(doc, atY, headerLabels, colWidths, ctx);

  y = drawHeader(y);

  for (let ri = 0; ri < resolved.length; ri += 1) {
    const row = resolved[ri]!;
    doc.setFontSize(7.5);

    const nameLines = cellLines(row.name, colMetric - 4);
    const oldLines = cellLines(row.oldDisplay, colOld - 4);
    const newLines = cellLines(row.newDisplay, colNew - 4);
    const changeLines = cellLines(row.changePct ?? "—", colChange - 4);
    const commentLines = cellLines(row.comment, colComment - 4);
    const lineCount = Math.max(
      nameLines.length,
      oldLines.length,
      newLines.length,
      changeLines.length,
      commentLines.length,
      1
    );
    const rowH = Math.max(7, lineCount * LINE_H + ROW_PAD);

    const prevY = y;
    y = ensureSpace(doc, y, rowH + 1);
    if (y < prevY - 1) {
      y = drawHeader(y);
    }

    const rgb = VERDICT_RGB[row.verdict];
    if (ri % 2 === 0) {
      doc.setFillColor(252, 252, 254);
      doc.rect(startX, y - 1, tableW, rowH + 1, "F");
    }

    const textY = y + ROW_PAD;
    let x = startX + 2;

    doc.setFont(ctx.turkish ? "NotoSans" : "helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.text(nameLines, x, textY);
    x += colMetric;

    doc.setFont(ctx.turkish ? "NotoSans" : "helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(oldLines, x + 2, textY);
    x += colOld;
    doc.text(newLines, x + 2, textY);
    x += colNew;

    doc.setTextColor(...rgb);
    doc.text(changeLines, x + 2, textY);
    x += colChange;

    doc.setTextColor(60, 60, 60);
    doc.text(commentLines, x + 2, textY);

    y += rowH;
  }

  doc.setTextColor(40, 40, 40);
  applyFootersToAllPages(doc, ctx, "Peaker Saha Testi Kıyas Raporu");
  return pdfToBytes(doc);
}

export function fieldTestComparisonPdfFilename(athleteName: string, dateFrom: string, dateTo: string): string {
  return ensurePdfExtension(
    `saha-testi-kiyas_${pdfFilenameSlug(athleteName)}_${dateFrom}_${dateTo}`
  );
}

export { classifyFieldTestComparison, formatChangePercent, comparisonCommentTr };
