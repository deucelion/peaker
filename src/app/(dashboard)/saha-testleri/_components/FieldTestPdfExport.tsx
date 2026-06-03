"use client";

import { useState } from "react";
import { Download, FileText, GitCompare, Loader2, MoreVertical } from "lucide-react";
import type { ProfileBasic, TestDefinitionRow } from "@/types/domain";
import { listAthleticResultsForActorByDate } from "@/lib/actions/athleticFieldActions";
import { isTextMetricValueType } from "@/lib/fieldTests/metricValueType";
import {
  buildFieldTestSingleDatePdf,
  fieldTestSingleDatePdfFilename,
  type FieldTestMetricEntry,
} from "@/lib/pdf/fieldTestPdf";
import {
  buildFieldTestComparisonPdf,
  fieldTestComparisonPdfFilename,
  filterChangedComparisonRows,
  type FieldTestComparisonRow,
} from "@/lib/pdf/fieldTestComparisonPdf";
import { downloadPdfBytes, runPdfTask } from "@/lib/pdf/pdfCommon";

type MetricRow = TestDefinitionRow & { valueType?: unknown };

function metricIsText(m: MetricRow): boolean {
  const ext = m as MetricRow & { value_type?: unknown };
  return isTextMetricValueType(ext.value_type ?? ext.valueType);
}

function cellValue(
  testValues: Record<string, string | number>,
  profileId: string,
  metricId: string
): string {
  const raw = testValues[`${profileId}-${metricId}`];
  if (raw === undefined || raw === null || raw === "") return "";
  return String(raw);
}

function buildMetricEntries(
  metrics: MetricRow[],
  testValues: Record<string, string | number>,
  profileId: string,
  kind: "number" | "text"
): FieldTestMetricEntry[] {
  return metrics
    .filter((m) => (kind === "text" ? metricIsText(m) : !metricIsText(m)))
    .map((m) => ({
      name: m.name,
      category: m.category,
      unit: m.unit,
      value: cellValue(testValues, profileId, m.id) || "—",
    }));
}

type Props = {
  globalDate: string;
  compareDateFrom: string;
  compareDateTo: string;
  onCompareDateFromChange: (v: string) => void;
  onCompareDateToChange: (v: string) => void;
  selectedPlayers: string[];
  players: ProfileBasic[];
  metrics: MetricRow[];
  testValues: Record<string, string | number>;
  generalNotes: Record<string, string>;
};

export function FieldTestPdfExport({
  globalDate,
  compareDateFrom,
  compareDateTo,
  onCompareDateFromChange,
  onCompareDateToChange,
  selectedPlayers,
  players,
  metrics,
  testValues,
  generalNotes,
}: Props) {
  const [busy, setBusy] = useState<"single" | "compare" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [compareOnlyChanged, setCompareOnlyChanged] = useState(false);

  const requireOneAthlete = (): ProfileBasic | null => {
    if (selectedPlayers.length !== 1) {
      setMessage("PDF için tam olarak bir sporcu seçin.");
      return null;
    }
    const p = players.find((x) => x.id === selectedPlayers[0]);
    if (!p) {
      setMessage("Sporcu bulunamadı.");
      return null;
    }
    return p;
  };

  const handleSinglePdf = async () => {
    const athlete = requireOneAthlete();
    if (!athlete) return;
    setBusy("single");
    setMessage("PDF hazırlanıyor…");
    try {
      const numeric = buildMetricEntries(metrics, testValues, athlete.id, "number");
      const text = buildMetricEntries(metrics, testValues, athlete.id, "text");
      const bytes = await runPdfTask(() =>
        buildFieldTestSingleDatePdf({
          athlete: {
            fullName: athlete.full_name,
            testDate: globalDate,
            heightCm: athlete.height ?? null,
            weightKg: athlete.weight ?? null,
          },
          numericMetrics: numeric,
          textMetrics: text,
          generalNote: generalNotes[athlete.id] ?? null,
        })
      );
      downloadPdfBytes(bytes, fieldTestSingleDatePdfFilename(athlete.full_name, globalDate));
      setMessage("Tek tarih PDF indirildi.");
    } catch {
      setMessage("PDF oluşturulamadı.");
    } finally {
      setBusy(null);
      setMenuOpen(false);
    }
  };

  const handleComparePdf = async () => {
    const athlete = requireOneAthlete();
    if (!athlete) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(compareDateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(compareDateTo)) {
      setMessage("Kıyas için geçerli iki tarih seçin.");
      return;
    }
    if (compareDateFrom > compareDateTo) {
      setMessage("Eski tarih yeni tarihten sonra olamaz.");
      return;
    }

    setBusy("compare");
    setMessage("Kıyas verisi alınıyor…");
    try {
      const [oldRes, newRes] = await Promise.all([
        listAthleticResultsForActorByDate({ profileIds: [athlete.id], testDate: compareDateFrom }),
        listAthleticResultsForActorByDate({ profileIds: [athlete.id], testDate: compareDateTo }),
      ]);
      if ("error" in oldRes || "error" in newRes) {
        setMessage("Kıyas verisi alınamadı.");
        return;
      }

      const oldMap = new Map(oldRes.results.map((r) => [r.test_id, r]));
      const newMap = new Map(newRes.results.map((r) => [r.test_id, r]));

      let rows: FieldTestComparisonRow[] = metrics.map((m) => {
        const oldR = oldMap.get(m.id);
        const newR = newMap.get(m.id);
        const isText = metricIsText(m);
        const direction =
          (m.improvement_direction as FieldTestComparisonRow["direction"]) || "unknown";

        if (isText) {
          return {
            name: m.name,
            unit: m.unit,
            oldDisplay: (oldR?.value_text || "").trim() || "—",
            newDisplay: (newR?.value_text || "").trim() || "—",
            direction,
            isText: true,
          };
        }

        const oldNum = typeof oldR?.value === "number" ? oldR.value : null;
        const newNum = typeof newR?.value === "number" ? newR.value : null;
        return {
          name: m.name,
          unit: m.unit,
          oldDisplay: oldNum != null ? String(oldNum) : "—",
          newDisplay: newNum != null ? String(newNum) : "—",
          oldNumeric: oldNum,
          newNumeric: newNum,
          direction,
        };
      });

      if (compareOnlyChanged) {
        rows = filterChangedComparisonRows(rows);
      }

      if (rows.length === 0) {
        setMessage(compareOnlyChanged ? "Değişen metrik bulunamadı." : "Kıyaslanacak metrik yok.");
        return;
      }

      setMessage("PDF oluşturuluyor…");
      const bytes = await runPdfTask(() =>
        buildFieldTestComparisonPdf({
          athleteName: athlete.full_name,
          dateFrom: compareDateFrom,
          dateTo: compareDateTo,
          rows,
        })
      );
      downloadPdfBytes(
        bytes,
        fieldTestComparisonPdfFilename(athlete.full_name, compareDateFrom, compareDateTo)
      );
      setMessage("Kıyas PDF indirildi.");
    } catch {
      setMessage("Kıyas PDF oluşturulamadı.");
    } finally {
      setBusy(null);
      setMenuOpen(false);
    }
  };

  const disabled = busy !== null;

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="hidden sm:flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => void handleSinglePdf()}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-black uppercase tracking-wide text-gray-300 hover:border-[#7c3aed]/40 hover:text-white disabled:opacity-50"
        >
          {busy === "single" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <FileText size={12} aria-hidden />}
          PDF İndir
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void handleComparePdf()}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-black uppercase tracking-wide text-gray-300 hover:border-amber-500/40 hover:text-white disabled:opacity-50"
        >
          {busy === "compare" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <GitCompare size={12} aria-hidden />}
          Kıyas PDF
        </button>
      </div>

      <div className="sm:hidden relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setMenuOpen((o) => !o)}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#121215] px-4 text-[10px] font-black uppercase tracking-wide text-gray-300"
          aria-expanded={menuOpen}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <MoreVertical size={14} aria-hidden />}
          PDF menü
        </button>
        {menuOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-20 cursor-default bg-black/40"
              aria-label="Menüyü kapat"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-full z-30 mt-1 min-w-[11rem] rounded-xl border border-white/10 bg-[#1c1c21] p-1 shadow-xl pb-[max(0.25rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[10px] font-black uppercase text-gray-200 hover:bg-white/5"
                onClick={() => void handleSinglePdf()}
              >
                <Download size={12} aria-hidden /> Tek tarih PDF
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[10px] font-black uppercase text-gray-200 hover:bg-white/5"
                onClick={() => void handleComparePdf()}
              >
                <GitCompare size={12} aria-hidden /> Kıyas PDF
              </button>
            </div>
          </>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/20 p-2.5 sm:grid sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[9px] font-black uppercase text-gray-500">
          Kıyas — eski tarih
          <input
            type="date"
            value={compareDateFrom}
            onChange={(e) => onCompareDateFromChange(e.target.value)}
            className="min-h-10 rounded-lg border border-white/10 bg-black/40 px-2 text-xs font-bold text-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-[9px] font-black uppercase text-gray-500">
          Kıyas — yeni tarih
          <input
            type="date"
            value={compareDateTo}
            onChange={(e) => onCompareDateToChange(e.target.value)}
            className="min-h-10 rounded-lg border border-white/10 bg-black/40 px-2 text-xs font-bold text-white"
          />
        </label>
        <label className="flex min-h-10 cursor-pointer items-center gap-2 text-[9px] font-black uppercase text-gray-400 sm:col-span-2">
          <input
            type="checkbox"
            checked={compareOnlyChanged}
            onChange={(e) => setCompareOnlyChanged(e.target.checked)}
            className="size-4 accent-[#7c3aed]"
          />
          Yalnızca değişen metrikler (kıyas PDF)
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
