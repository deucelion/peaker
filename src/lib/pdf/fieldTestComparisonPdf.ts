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
  const cols = [52, 28, 28, 22, 38, pageW - PDF_LAYOUT_MARGIN - 52 - 28 - 28 - 22 - 38];
  const headerLabels = ["Metrik", "Eski", "Yeni", "Değişim", "Yorum"];
  const headerWidths = [cols[0]!, cols[1]!, cols[2]!, cols[3]!, cols[5]!];

  const drawHeader = (atY: number) => drawTableHeaderBar(doc, atY, headerLabels, headerWidths, ctx);

  y = drawHeader(y);

  for (let ri = 0; ri < resolved.length; ri += 1) {
    const row = resolved[ri]!;
    const prevY = y;
    y = ensureSpace(doc, y, 7);
    if (y < prevY - 1) {
      y = drawHeader(y);
    }

    const rgb = VERDICT_RGB[row.verdict];
    if (ri % 2 === 0) {
      doc.setFillColor(252, 252, 254);
      doc.rect(startX, y - 3, pageW - startX * 2, 6.5, "F");
    }

    doc.setFontSize(7.5);
    doc.setFont(ctx.turkish ? "NotoSans" : "helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    let x = startX + 2;
    doc.text(pdfT(row.name, ctx), x, y, { maxWidth: cols[0]! - 4 });
    x += cols[0]!;
    doc.setFont(ctx.turkish ? "NotoSans" : "helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(pdfT(row.oldDisplay, ctx), x, y);
    x += cols[1]!;
    doc.text(pdfT(row.newDisplay, ctx), x, y);
    x += cols[2]!;
    doc.setTextColor(...rgb);
    doc.text(pdfT(row.changePct ?? "—", ctx), x, y);
    x += cols[3]!;
    doc.text(pdfT(row.comment, ctx), x, y, { maxWidth: cols[5]! - 2 });
    y += 5.5;
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
