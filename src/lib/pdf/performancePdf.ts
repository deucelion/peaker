import type { AcwrPoint, EwmaPoint, TrainingLoadRow } from "@/types/performance";
import type { AcwrRiskLevel } from "@/lib/performance/acwrInsights";
import {
  buildPerformanceSmartAnalysis,
  summarizeLast30DaysLoads,
} from "@/lib/performance/performanceSummary";
import { createPdfDocument } from "@/lib/pdf/pdfFont";
import { pdfFilenameSlug, ensurePdfExtension } from "@/lib/pdf/pdfFilename";
import { formatPdfPersonName, isValidPdfChartImage } from "@/lib/pdf/pdfFormat";
import {
  drawAtAGlanceBanner,
  drawHighlightCallout,
  drawKpiCardRow,
  formatAcwrDisplay,
  formatEwmaDisplay,
  PDF_RISK_RGB,
} from "@/lib/pdf/pdfLayout";
import type { PdfBrandingPresentation } from "@/lib/navigation/pdfBrandingPresentation";
import {
  applyFootersToAllPages,
  downsampleChartPoints,
  drawEmbeddedChartImage,
  drawKeyValueRows,
  drawPdfEmptyNotice,
  drawReportHeader,
  drawSectionTitle,
  drawSimpleLineChart,
  ensureSpace,
  pdfToBytes,
  resolvePdfBrandOptions,
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
  pdfBranding?: PdfBrandingPresentation;
};

export class PerformancePdfNoDataError extends Error {
  constructor(message = "Seçilen dönemde idman yükü kaydı bulunmuyor.") {
    super(message);
    this.name = "PerformancePdfNoDataError";
  }
}

export function performanceHasLoadData(
  loads: TrainingLoadRow[],
  acwrPoints: AcwrPoint[]
): boolean {
  return summarizeLast30DaysLoads(loads, acwrPoints).sessionCount > 0;
}

function dominantRiskLevel(acwr: AcwrRiskLevel, ewma: AcwrRiskLevel): AcwrRiskLevel {
  if (acwr === "high" || ewma === "high") return "high";
  if (acwr === "caution" || ewma === "caution") return "caution";
  if (acwr === "optimal" && ewma === "optimal") return "optimal";
  if (acwr === "nodata" && ewma === "nodata") return "nodata";
  return acwr !== "nodata" ? acwr : ewma;
}

function drawAcwrChartSection(
  doc: Awaited<ReturnType<typeof createPdfDocument>>["doc"],
  y: number,
  acwrSeries: AcwrPoint[],
  chartImage: string | null | undefined,
  chartW: number,
  ctx: PdfTextContext
): number {
  y = drawSectionTitle(doc, y, "ACWR Trendi", ctx);
  if (isValidPdfChartImage(chartImage)) {
    return drawEmbeddedChartImage(doc, 14, y, chartW, 50, chartImage!, ctx);
  }
  const acwrChart = downsampleChartPoints(acwrSeries);
  if (acwrChart.length >= 2) {
    y = ensureSpace(doc, y, 54);
    return drawSimpleLineChart(
      doc,
      14,
      y,
      chartW,
      42,
      "ACWR oranı (0,8–1,3 optimal bölge)",
      [{ label: "ratio", color: [245, 158, 11], points: acwrChart.map((p, i) => ({ x: i, y: p.ratio })) }],
      ctx,
      { optimalBand: [0.8, 1.3] }
    );
  }
  return drawPdfEmptyNotice(doc, y, "ACWR grafiği için en az 2 günlük yük kaydı gerekir.", ctx);
}

function drawEwmaChartSection(
  doc: Awaited<ReturnType<typeof createPdfDocument>>["doc"],
  y: number,
  ewmaSeries: EwmaPoint[],
  chartImage: string | null | undefined,
  chartW: number,
  ctx: PdfTextContext
): number {
  y = drawSectionTitle(doc, y, "EWMA Trendi", ctx);
  if (isValidPdfChartImage(chartImage)) {
    return drawEmbeddedChartImage(doc, 14, y, chartW, 50, chartImage!, ctx);
  }
  const ewmaChart = downsampleChartPoints(ewmaSeries);
  if (ewmaChart.length >= 2) {
    y = ensureSpace(doc, y, 54);
    y = drawSimpleLineChart(
      doc,
      14,
      y,
      chartW,
      38,
      "Akut / Kronik yük (EWMA)",
      [
        { label: "acute", color: [124, 58, 237], points: ewmaChart.map((p, i) => ({ x: i, y: p.acuteEwma })) },
        { label: "chronic", color: [55, 65, 81], points: ewmaChart.map((p, i) => ({ x: i, y: p.chronicEwma })) },
      ],
      ctx
    );
    y = ensureSpace(doc, y, 50);
    return drawSimpleLineChart(
      doc,
      14,
      y,
      chartW,
      34,
      "EWMA oranı",
      [{ label: "ewmaRatio", color: [245, 158, 11], points: ewmaChart.map((p, i) => ({ x: i, y: p.ewmaRatio })) }],
      ctx,
      { optimalBand: [0.8, 1.3] }
    );
  }
  return drawPdfEmptyNotice(doc, y, "EWMA grafiği için en az 2 günlük yük kaydı gerekir.", ctx);
}

export async function buildPerformanceAnalysisPdf(input: PerformancePdfInput): Promise<Uint8Array> {
  const displayName = formatPdfPersonName(input.athleteName);
  const summary30 = summarizeLast30DaysLoads(input.loads30, input.acwr30);
  if (summary30.sessionCount === 0) {
    throw new PerformancePdfNoDataError();
  }

  const { doc, turkish } = await createPdfDocument("p");
  const ctx: PdfTextContext = { turkish };
  const lastAcwr = input.acwrSeries[input.acwrSeries.length - 1] ?? null;
  const lastEwma = input.ewmaSeries[input.ewmaSeries.length - 1] ?? null;
  const smart = buildPerformanceSmartAnalysis({
    lastAcwr,
    ewmaSeries: input.ewmaSeries,
  });

  const dominant = dominantRiskLevel(smart.acwr.riskLevel, smart.ewma.riskLevel);
  const riskRgb = PDF_RISK_RGB[dominant];

  const resolvedBranding = resolvePdfBrandOptions({
    orgName: input.orgName,
    reportTitle: "Yük Dengesi Analiz Raporu",
    subtitle: `${displayName} · ${input.periodLabel}`,
    pdfBranding: input.pdfBranding,
  });

  let y = drawReportHeader(
    doc,
    resolvedBranding,
    ctx
  );

  y = drawAtAGlanceBanner(
    doc,
    y,
    {
      riskLabel: smart.riskLevel,
      riskLevel: dominant,
      acwrText: formatAcwrDisplay(lastAcwr?.ratio ?? 0),
      ewmaText: formatEwmaDisplay(lastEwma?.ewmaRatio ?? 0),
      summary: smart.generalLoadStatus,
    },
    ctx
  );

  y = drawKpiCardRow(
    doc,
    y,
    [
      { label: "Antrenman", value: String(summary30.sessionCount), accent: riskRgb },
      { label: "Ort. yük", value: String(summary30.avgLoad) },
      { label: "Max yük", value: String(summary30.maxLoad) },
      {
        label: "Riskli gün",
        value: String(summary30.riskyDayCount),
        accent: summary30.riskyDayCount > 0 ? PDF_RISK_RGB.high : PDF_RISK_RGB.optimal,
      },
    ],
    ctx
  );

  y = drawHighlightCallout(doc, y, "Önerilen aksiyon", smart.recommendedAction, ctx);

  const chartW = doc.internal.pageSize.getWidth() - 28;
  y = drawAcwrChartSection(doc, y, input.acwrSeries, input.chartImages?.acwr, chartW, ctx);
  y = drawEwmaChartSection(doc, y, input.ewmaSeries, input.chartImages?.ewma, chartW, ctx);

  y = drawSectionTitle(doc, y, "Detaylı Analiz", ctx);
  drawKeyValueRows(
    doc,
    y,
    [
      { label: "ACWR durumu", value: smart.acwr.summary },
      { label: "EWMA durumu", value: smart.ewma.summary },
      { label: "Recovery", value: smart.recoveryAdvice },
      { label: "Koç notu", value: smart.trainingAdvice },
    ],
    ctx
  );

  applyFootersToAllPages(doc, ctx, resolvedBranding.pdfBranding.title);
  return pdfToBytes(doc);
}

export function performanceAnalysisPdfFilename(athleteName: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return ensurePdfExtension(`performans-analiz_${pdfFilenameSlug(athleteName)}_${stamp}`);
}
