"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, GitCompare, Loader2 } from "lucide-react";
import {
  listAthleticResultNotesByDate,
  listAthleticResultsForActorByDate,
  listFieldTestDefinitionsForActor,
  getFieldTestOrganizationDisplayName,
} from "@/lib/actions/athleticFieldActions";
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
import type { TestDefinitionRow } from "@/types/domain";

type Props = {
  athleteId: string;
  athleteName: string;
  heightCm?: number | null;
  weightKg?: number | null;
  /** Mevcut sonuçlardan varsayılan tarih türetmek için */
  testDates: string[];
};

function metricIsText(m: TestDefinitionRow): boolean {
  const ext = m as TestDefinitionRow & { value_type?: unknown; valueType?: unknown };
  return isTextMetricValueType(ext.value_type ?? ext.valueType);
}

function latestDate(dates: string[]): string {
  const keys = dates.map((d) => d.split("T")[0]).filter(Boolean).sort();
  return keys[keys.length - 1] || new Date().toISOString().split("T")[0]!;
}

function monthsAgoDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().split("T")[0]!;
}

export function AthleteFieldTestPdfExport({
  athleteId,
  athleteName,
  heightCm,
  weightKg,
  testDates,
}: Props) {
  const latest = useMemo(() => latestDate(testDates), [testDates]);
  const [singleDate, setSingleDate] = useState(latest);
  const [compareFrom, setCompareFrom] = useState(() => monthsAgoDate(3));
  const [compareTo, setCompareTo] = useState(latest);
  const [compareOnlyChanged, setCompareOnlyChanged] = useState(false);
  const [busy, setBusy] = useState<"single" | "compare" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setSingleDate(latest);
    setCompareTo(latest);
  }, [latest]);

  const handleSinglePdf = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(singleDate)) {
      setMessage("Geçerli bir test tarihi seçin.");
      return;
    }
    setBusy("single");
    setMessage("Veri alınıyor…");
    try {
      const [defsRes, orgRes, dataRes, notesRes] = await Promise.all([
        listFieldTestDefinitionsForActor(),
        getFieldTestOrganizationDisplayName(),
        listAthleticResultsForActorByDate({ profileIds: [athleteId], testDate: singleDate }),
        listAthleticResultNotesByDate({ profileIds: [athleteId], testDate: singleDate }),
      ]);
      if ("error" in defsRes || "error" in dataRes) {
        setMessage("Test verisi alınamadı.");
        return;
      }
      const pdfOrgName = "error" in orgRes ? undefined : orgRes.orgName;
      const metrics = (defsRes.metrics || []) as unknown as TestDefinitionRow[];
      const resultMap = new Map((dataRes.results || []).map((r) => [r.test_id, r]));
      const buildEntries = (kind: "number" | "text"): FieldTestMetricEntry[] =>
        metrics
          .filter((m) => (kind === "text" ? metricIsText(m) : !metricIsText(m)))
          .map((m) => {
            const row = resultMap.get(m.id);
            const value =
              kind === "text"
                ? (row?.value_text || "").trim() || "—"
                : typeof row?.value === "number"
                  ? String(row.value)
                  : "—";
            return { name: m.name, category: m.category, unit: m.unit, value };
          })
          .filter((e) => e.value !== "—");

      const note =
        "error" in notesRes
          ? null
          : notesRes.notes.find((n) => n.profile_id === athleteId)?.note ?? null;

      setMessage("PDF oluşturuluyor…");
      const bytes = await runPdfTask(() =>
        buildFieldTestSingleDatePdf({
          orgName: pdfOrgName,
          athlete: {
            fullName: athleteName,
            testDate: singleDate,
            heightCm: heightCm ?? null,
            weightKg: weightKg ?? null,
          },
          numericMetrics: buildEntries("number"),
          textMetrics: buildEntries("text"),
          generalNote: note,
        })
      );
      downloadPdfBytes(bytes, fieldTestSingleDatePdfFilename(athleteName, singleDate));
      setMessage("Tek gün PDF indirildi.");
    } catch {
      setMessage("PDF oluşturulamadı.");
    } finally {
      setBusy(null);
    }
  };

  const handleComparePdf = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(compareFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(compareTo)) {
      setMessage("Kıyas için iki geçerli tarih seçin.");
      return;
    }
    if (compareFrom > compareTo) {
      setMessage("Eski tarih yeni tarihten sonra olamaz.");
      return;
    }

    setBusy("compare");
    setMessage("Kıyas verisi alınıyor…");
    try {
      const [defsRes, orgRes, oldRes, newRes] = await Promise.all([
        listFieldTestDefinitionsForActor(),
        getFieldTestOrganizationDisplayName(),
        listAthleticResultsForActorByDate({ profileIds: [athleteId], testDate: compareFrom }),
        listAthleticResultsForActorByDate({ profileIds: [athleteId], testDate: compareTo }),
      ]);
      if ("error" in defsRes || "error" in oldRes || "error" in newRes) {
        setMessage("Kıyas verisi alınamadı.");
        return;
      }
      const pdfOrgName = "error" in orgRes ? undefined : orgRes.orgName;

      const metrics = (defsRes.metrics || []) as unknown as TestDefinitionRow[];

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
          orgName: pdfOrgName,
          athleteName,
          dateFrom: compareFrom,
          dateTo: compareTo,
          rows,
        })
      );
      downloadPdfBytes(bytes, fieldTestComparisonPdfFilename(athleteName, compareFrom, compareTo));
      setMessage("Kıyas PDF indirildi.");
    } catch {
      setMessage("Kıyas PDF oluşturulamadı.");
    } finally {
      setBusy(null);
    }
  };

  const disabled = busy !== null;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-4 min-w-0">
      <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Saha testi PDF</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2 rounded-xl border border-white/5 bg-black/20 p-3">
          <p className="text-[9px] font-bold normal-case text-gray-600">Seçilen günün tüm test sonuçları</p>
          <label className="flex flex-col gap-1 text-[9px] font-black uppercase text-gray-500">
            Test tarihi
            <input
              type="date"
              value={singleDate}
              onChange={(e) => setSingleDate(e.target.value)}
              className="min-h-10 rounded-xl border border-white/10 bg-black px-3 text-xs font-bold text-white"
            />
          </label>
          <button
            type="button"
            disabled={disabled}
            onClick={() => void handleSinglePdf()}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#7c3aed]/40 bg-[#7c3aed]/10 px-3 text-[9px] font-black uppercase tracking-widest text-[#c4b5fd] hover:bg-[#7c3aed]/20 disabled:opacity-50 touch-manipulation"
          >
            {busy === "single" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <FileText size={12} aria-hidden />}
            Tek gün PDF
          </button>
        </div>

        <div className="space-y-2 rounded-xl border border-white/5 bg-black/20 p-3">
          <p className="text-[9px] font-bold normal-case text-gray-600">İki tarih arası metrik farkları</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[9px] font-black uppercase text-gray-500">
              Eski
              <input
                type="date"
                value={compareFrom}
                onChange={(e) => setCompareFrom(e.target.value)}
                className="min-h-10 rounded-xl border border-white/10 bg-black px-3 text-xs font-bold text-white"
              />
            </label>
            <label className="flex flex-col gap-1 text-[9px] font-black uppercase text-gray-500">
              Yeni
              <input
                type="date"
                value={compareTo}
                onChange={(e) => setCompareTo(e.target.value)}
                className="min-h-10 rounded-xl border border-white/10 bg-black px-3 text-xs font-bold text-white"
              />
            </label>
          </div>
          <label className="flex min-h-9 cursor-pointer items-center gap-2 text-[9px] font-black uppercase text-gray-500">
            <input
              type="checkbox"
              checked={compareOnlyChanged}
              onChange={(e) => setCompareOnlyChanged(e.target.checked)}
              className="size-4 accent-[#7c3aed]"
            />
            Yalnızca değişenler
          </label>
          <button
            type="button"
            disabled={disabled}
            onClick={() => void handleComparePdf()}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 text-[9px] font-black uppercase tracking-widest text-amber-200 hover:bg-amber-500/20 disabled:opacity-50 touch-manipulation"
          >
            {busy === "compare" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <GitCompare size={12} aria-hidden />}
            Kıyas PDF
          </button>
        </div>
      </div>

      {message ? (
        <p className="text-[10px] font-black uppercase tracking-widest text-[#c4b5fd]" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
