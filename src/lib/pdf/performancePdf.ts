import type { AcwrPoint, EwmaPoint, TrainingLoadRow } from "@/types/performance";
import {
  buildPerformanceSmartAnalysis,
  summarizeLast30DaysLoads,
  type PerformanceSmartAnalysis,
} from "@/lib/performance/performanceSummary";
import { createPdfDocument } from "@/lib/pdf/pdfFont";
import { pdfFilenameSlug, ensurePdfExtension } from "@/lib/pdf/pdfFilename";
import {
  applyFootersToAllPages,
  downsampleChartPoints,
  drawEmbeddedChartImage,
  drawKeyValueRows,
  drawReportHeader,
  drawSectionTitle,
  drawSimpleLineChart,
  ensureSpace,
  pdfT,
  pdfToBytes,
  type PdfTextContext,
} from "@/lib/pdf/pdfCommon";

export type PerformancePdfInput = {
  orgName?: string;
  athleteName: string;
  periodLabel: string;
  acwrSeries: AcwrPoint[];
  ewmaSeries: EwmaPoint[];
  loads30: TrainingLoadRow[];
  acwr30: AcwrPoint[];
  chartImages?: { acwr?: string | null; ewma?: string | null };
  logoDataUrl?: string | null;
};

function drawSmartAnalysis(
  doc: Awaited<ReturnType<typeof createPdfDocument>>["doc"],
  y: number,
  analysis: PerformanceSmartAnalysis,
  ctx: PdfTextContext
): number {
  y = drawSectionTitle(doc, y, "Yapay Zeka Destekli Analiz (Kural Tabanlı)", ctx);
  return drawKeyValueRows(
    doc,
    y,
    [
      { label: "Genel yük durumu", value: analysis.generalLoadStatus },
      { label: "Risk seviyesi", value: analysis.riskLevel },
      { label: "Önerilen aksiyon", value: analysis.recommendedAction },
      { label: "Recovery önerisi", value: analysis.recoveryAdvice },
      { label: "Antrenman önerisi", value: analysis.trainingAdvice },
      { label: "ACWR özet", value: analysis.acwr.summary },
      { label: "EWMA özet", value: analysis.ewma.summary },
    ],
    ctx
  );
}

export async function buildPerformanceAnalysisPdf(input: PerformancePdfInput): Promise<Uint8Array> {
  const { doc, turkish } = await createPdfDocument("p");
  const ctx: PdfTextContext = { turkish };
  const lastAcwr = input.acwrSeries[input.acwrSeries.length - 1] ?? null;
  const summary30 = summarizeLast30DaysLoads(input.loads30, input.acwr30);
  const smart = buildPerformanceSmartAnalysis({
    lastAcwr,
    ewmaSeries: input.ewmaSeries,
  });

  let y = drawReportHeader(
    doc,
    {
      orgName: input.orgName,
      reportTitle: "Yük Dengesi Analiz Raporu",
      subtitle: `${input.athleteName} — ${input.periodLabel}`,
      logoDataUrl: input.logoDataUrl,
    },
    ctx
  );

  y = drawSectionTitle(doc, y, "Son 30 Gün Özeti", ctx);
  y = drawKeyValueRows(
    doc,
    y,
    [
      { label: "Ortalama yük", value: String(summary30.avgLoad) },
      { label: "En yüksek yük", value: String(summary30.maxLoad) },
      { label: "En düşük yük", value: String(summary30.minLoad) },
      { label: "Antrenman sayısı", value: String(summary30.sessionCount) },
      { label: "Riskli gün sayısı", value: String(summary30.riskyDayCount) },
    ],
    ctx
  );

  const chartW = doc.internal.pageSize.getWidth() - 28;
  const acwrChart = downsampleChartPoints(input.acwrSeries);
  const ewmaChart = downsampleChartPoints(input.ewmaSeries);

  if (input.chartImages?.acwr) {
    y = drawSectionTitle(doc, y, "ACWR Grafiği", ctx);
    y = drawEmbeddedChartImage(doc, 14, y, chartW, 48, "ACWR (ekran görüntüsü)", input.chartImages.acwr, ctx);
  } else if (acwrChart.length >= 2) {
    y = drawSectionTitle(doc, y, "ACWR Grafiği", ctx);
    y = ensureSpace(doc, y, 52);
    y = drawSimpleLineChart(
      doc,
      14,
      y,
      chartW,
      40,
      "ACWR oranı",
      [{ label: "ratio", color: [245, 158, 11], points: acwrChart.map((p, i) => ({ x: i, y: p.ratio })) }],
      ctx
    );
  } else {
    y = drawSectionTitle(doc, y, "ACWR Grafiği", ctx);
    y = ensureSpace(doc, y, 8);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(pdfT("Grafik için en az 2 günlük veri gerekir.", ctx), 14, y);
    y += 8;
  }

  if (input.chartImages?.ewma) {
    y = drawSectionTitle(doc, y, "EWMA Trendi", ctx);
    y = drawEmbeddedChartImage(doc, 14, y, chartW, 48, "EWMA (ekran görüntüsü)", input.chartImages.ewma, ctx);
  } else if (ewmaChart.length >= 2) {
    y = drawSectionTitle(doc, y, "EWMA Trendi", ctx);
    y = ensureSpace(doc, y, 52);
    y = drawSimpleLineChart(
      doc,
      14,
      y,
      chartW,
      40,
      "Akut / Kronik EWMA",
      [
        { label: "acute", color: [124, 58, 237], points: ewmaChart.map((p, i) => ({ x: i, y: p.acuteEwma })) },
        { label: "chronic", color: [55, 65, 81], points: ewmaChart.map((p, i) => ({ x: i, y: p.chronicEwma })) },
      ],
      ctx
    );
    y = ensureSpace(doc, y, 52);
    y = drawSimpleLineChart(
      doc,
      14,
      y,
      chartW,
      36,
      "EWMA oranı",
      [{ label: "ewmaRatio", color: [245, 158, 11], points: ewmaChart.map((p, i) => ({ x: i, y: p.ewmaRatio })) }],
      ctx
    );
  } else {
    y = drawSectionTitle(doc, y, "EWMA Trendi", ctx);
    y = ensureSpace(doc, y, 8);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(pdfT("EWMA grafiği için yeterli veri yok.", ctx), 14, y);
    y += 8;
  }

  drawSmartAnalysis(doc, y, smart, ctx);
  applyFootersToAllPages(doc, ctx);
  return pdfToBytes(doc);
}

export function performanceAnalysisPdfFilename(athleteName: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return ensurePdfExtension(`performans-analiz_${pdfFilenameSlug(athleteName)}_${stamp}`);
}
