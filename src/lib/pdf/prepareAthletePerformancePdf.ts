import type { TrainingLoadRow } from "@/types/performance";
import {
  fillCalendarDays,
  filterAcwrPointsByIstanbulInclusiveRange,
  filterEwmaPointsByIstanbulInclusiveRange,
  filterTrainingLoadsByIstanbulInclusiveRange,
  getLoadDate,
  processACWRData,
  processEWMAData,
} from "@/lib/performance/loadSeries";
import { SCHEDULE_APP_TIME_ZONE } from "@/lib/schedule/scheduleWallTime";
import {
  buildPerformanceAnalysisPdf,
  performanceAnalysisPdfFilename,
  performanceHasLoadData,
  PerformancePdfNoDataError,
} from "@/lib/pdf/performancePdf";

function formatTrRangeLabel(fromKey: string, toKey: string): string {
  const fmt = (k: string) =>
    new Date(`${k}T12:00:00`).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  return `${fmt(fromKey)} – ${fmt(toKey)}`;
}

export function hasPerformanceDataInRange(
  loads: TrainingLoadRow[],
  dateFrom: string,
  dateTo: string,
  tz: string = SCHEDULE_APP_TIME_ZONE
): boolean {
  const sorted = [...loads].sort((a, b) => getLoadDate(a).getTime() - getLoadDate(b).getTime());
  const filled = fillCalendarDays(sorted, dateFrom, dateTo, tz);
  const acwrFull = processACWRData(filled);
  const acwr30 = filterAcwrPointsByIstanbulInclusiveRange(acwrFull, dateFrom, dateTo, tz);
  const loads30 = filterTrainingLoadsByIstanbulInclusiveRange(filled, dateFrom, dateTo, tz);
  return performanceHasLoadData(loads30, acwr30);
}

export async function prepareAthletePerformancePdf(
  athleteName: string,
  loads: TrainingLoadRow[],
  dateFrom: string,
  dateTo: string,
  tz: string = SCHEDULE_APP_TIME_ZONE
): Promise<{ bytes: Uint8Array; filename: string }> {
  const sorted = [...loads].sort((a, b) => getLoadDate(a).getTime() - getLoadDate(b).getTime());
  const filled = fillCalendarDays(sorted, dateFrom, dateTo, tz);
  const acwrFull = processACWRData(filled);
  const ewmaFull = processEWMAData(filled);
  const acwr30 = filterAcwrPointsByIstanbulInclusiveRange(acwrFull, dateFrom, dateTo, tz);
  const ewma30 = filterEwmaPointsByIstanbulInclusiveRange(ewmaFull, dateFrom, dateTo, tz);
  const loads30 = filterTrainingLoadsByIstanbulInclusiveRange(filled, dateFrom, dateTo, tz);

  if (!performanceHasLoadData(loads30, acwr30)) {
    throw new PerformancePdfNoDataError();
  }

  const bytes = await buildPerformanceAnalysisPdf({
    athleteName,
    periodLabel: formatTrRangeLabel(dateFrom, dateTo),
    acwrSeries: acwr30,
    ewmaSeries: ewma30,
    loads30,
    acwr30,
  });

  return { bytes, filename: performanceAnalysisPdfFilename(athleteName) };
}
