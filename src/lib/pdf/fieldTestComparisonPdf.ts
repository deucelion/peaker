import { createPdfDocument } from "@/lib/pdf/pdfFont";
import { pdfFilenameSlug, ensurePdfExtension } from "@/lib/pdf/pdfFilename";
import {
  classifyFieldTestComparison,
  comparisonCommentTr,
  formatChangePercent,
  type ComparisonVerdict,
  type MetricImprovementDirection,
} from "@/lib/fieldTests/comparisonVerdict";
import {
  applyFootersToAllPages,
  drawKeyValueRows,
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

  let y = drawReportHeader(
    doc,
    {
      orgName: input.orgName,
      reportTitle: "Saha Testi Kıyas Raporu",
      subtitle: `${input.athleteName} — ${formatTrDate(input.dateFrom)} / ${formatTrDate(input.dateTo)}`,
      logoDataUrl: input.logoDataUrl,
    },
    ctx
  );

  y = drawKeyValueRows(
    doc,
    y,
    [
      { label: "Sporcu", value: input.athleteName },
      { label: "Eski tarih", value: formatTrDate(input.dateFrom) },
      { label: "Yeni tarih", value: formatTrDate(input.dateTo) },
    ],
    ctx
  );

  y = drawSectionTitle(doc, y, "Metrik Kıyas Tablosu", ctx);
  const startX = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const cols = [52, 28, 28, 22, 38, pageW - 14 - 52 - 28 - 28 - 22 - 38];

  doc.setFontSize(7);
  doc.setFont(ctx.turkish ? "NotoSans" : "helvetica", "bold");
  let x = startX;
  for (const [label, w] of [
    ["Metrik", cols[0]],
    ["Eski", cols[1]],
    ["Yeni", cols[2]],
    ["Değişim", cols[3]],
    ["Yorum", cols[4]],
  ] as const) {
    doc.text(pdfT(label, ctx), x, y);
    x += w!;
  }
  y += 5;
  doc.setFont(ctx.turkish ? "NotoSans" : "helvetica", "normal");

  for (const row of resolved) {
    y = ensureSpace(doc, y, 7);
    const rgb = VERDICT_RGB[row.verdict];
    doc.setTextColor(...rgb);
    x = startX;
    doc.text(pdfT(row.name, ctx), x, y, { maxWidth: cols[0]! - 2 });
    x += cols[0]!;
    doc.setTextColor(60, 60, 60);
    doc.text(pdfT(row.oldDisplay, ctx), x, y);
    x += cols[1]!;
    doc.text(pdfT(row.newDisplay, ctx), x, y);
    x += cols[2]!;
    doc.text(pdfT(row.changePct ?? "—", ctx), x, y);
    x += cols[3]!;
    doc.setTextColor(...rgb);
    doc.text(pdfT(row.comment, ctx), x, y, { maxWidth: cols[5]! - 2 });
    y += 5.5;
  }

  doc.setTextColor(40, 40, 40);
  applyFootersToAllPages(doc, ctx);
  return pdfToBytes(doc);
}

export function fieldTestComparisonPdfFilename(athleteName: string, dateFrom: string, dateTo: string): string {
  return ensurePdfExtension(
    `saha-testi-kiyas_${pdfFilenameSlug(athleteName)}_${dateFrom}_${dateTo}`
  );
}

export { classifyFieldTestComparison, formatChangePercent, comparisonCommentTr };
