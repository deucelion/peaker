"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import type { TrainingLoadRow } from "@/types/performance";
import { getLoadDate } from "@/lib/performance/loadSeries";
import { isoToZonedDateKey } from "@/lib/schedule/scheduleWallTime";
import { addCalendarDaysToYyyyMmDd } from "@/lib/performance/performanceDateRange";
import { prepareAthletePerformancePdf, hasPerformanceDataInRange } from "@/lib/pdf/prepareAthletePerformancePdf";
import { PerformancePdfNoDataError } from "@/lib/pdf/performancePdf";
import { downloadPdfBytes, pdfDownloadUserMessage, runPdfTask } from "@/lib/pdf/pdfCommon";
import { loadPdfBrandingPresentationFromMeAccess } from "@/lib/navigation/loadPdfBrandingPresentationFromMeAccess";

type Props = {
  athleteName: string;
  loads: TrainingLoadRow[];
};

function defaultRange(loads: TrainingLoadRow[]): { from: string; to: string } {
  if (loads.length === 0) {
    const to = new Date().toISOString().split("T")[0]!;
    return { from: addCalendarDaysToYyyyMmDd(to, -29), to };
  }
  const sorted = [...loads].sort((a, b) => getLoadDate(a).getTime() - getLoadDate(b).getTime());
  const toKey = isoToZonedDateKey(sorted[sorted.length - 1]!.measurement_date || "") || new Date().toISOString().split("T")[0]!;
  return { from: addCalendarDaysToYyyyMmDd(toKey, -29), to: toKey };
}

export function AthletePerformancePdfExport({ athleteName, loads }: Props) {
  const initial = useMemo(() => defaultRange(loads), [loads]);
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDateFrom(initial.from);
    setDateTo(initial.to);
  }, [initial.from, initial.to]);

  const handleExport = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      setMessage("Geçerli bir tarih aralığı seçin.");
      return;
    }
    if (dateFrom > dateTo) {
      setMessage("Başlangıç tarihi bitişten sonra olamaz.");
      return;
    }
    if (loads.length === 0) {
      setMessage("Bu aralık için yük verisi yok.");
      return;
    }
    if (!hasPerformanceDataInRange(loads, dateFrom, dateTo)) {
      setMessage("Seçilen dönemde idman yükü kaydı yok — PDF oluşturulamaz.");
      return;
    }

    setBusy(true);
    setMessage("PDF oluşturuluyor…");
    try {
      const pdfBranding = await loadPdfBrandingPresentationFromMeAccess();
      const { bytes, filename } = await runPdfTask(() =>
        prepareAthletePerformancePdf(athleteName, loads, dateFrom, dateTo, pdfBranding)
      );
      const outcome = await downloadPdfBytes(bytes, filename);
      setMessage(pdfDownloadUserMessage(outcome, "Analiz PDF indirildi."));
    } catch (err) {
      if (err instanceof PerformancePdfNoDataError) {
        setMessage(err.message);
      } else {
        setMessage("PDF oluşturulamadı.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-3 min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Performans PDF</p>
          <p className="text-[9px] font-bold normal-case text-gray-600 mt-0.5">
            ACWR, EWMA ve seçilen dönemin yük özeti
          </p>
        </div>
        <button
          type="button"
          disabled={busy || loads.length === 0}
          onClick={() => void handleExport()}
          className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-[#7c3aed]/40 bg-[#7c3aed]/10 px-4 py-2 text-[9px] font-black uppercase tracking-widest text-[#c4b5fd] hover:bg-[#7c3aed]/20 disabled:opacity-50 touch-manipulation"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <FileText size={12} aria-hidden />}
          Analiz PDF
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-[9px] font-black uppercase text-gray-500">
          Başlangıç
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="min-h-10 rounded-xl border border-white/10 bg-black px-3 text-xs font-bold text-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-[9px] font-black uppercase text-gray-500">
          Bitiş
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="min-h-10 rounded-xl border border-white/10 bg-black px-3 text-xs font-bold text-white"
          />
        </label>
      </div>
      {message ? (
        <p className="text-[10px] font-black uppercase tracking-widest text-[#c4b5fd]" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
