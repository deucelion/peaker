"use client";

import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";
import { useMemo, useState } from "react";
import { Calendar, GitCompare, History, LineChart as LineChartIcon, Table2 } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { AthleteFieldTestPdfExport } from "./_components/AthleteFieldTestPdfExport";
import { fieldTestResultRowDisplay } from "@/lib/fieldTests/hydrateFieldTestValuesFromResults";
import {
  resolveAthleteFieldTestDateRange,
  resolveAthleteFieldTestSelectedNames,
} from "@/lib/fieldTests/athleteFieldTestFilter";
import { isTextMetricValueType } from "@/lib/fieldTests/metricValueType";
import { DataTable, uiTableRowHoverClass, uiTableTdClass, uiTableThClass } from "@/components/ui/data-display";

export type FieldTestResultRow = {
  value: number | null;
  value_text?: string | null;
  test_date: string;
  test_id?: string | null;
  test_definitions?: { id?: string; name?: string; unit?: string; value_type?: "number" | "text" | null } | null;
};

function testName(r: FieldTestResultRow) {
  return r.test_definitions?.name?.trim() || "Bilinmeyen";
}

function dayKey(iso: string) {
  if (!iso) return "";
  return iso.split("T")[0];
}

function inDateRange(iso: string, from: string, to: string): boolean {
  const d = dayKey(iso);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function aggregateAvgByTest(rows: FieldTestResultRow[]) {
  const m = new Map<string, { sum: number; count: number; unit: string }>();
  for (const r of rows) {
    if (isTextMetricValueType(r.test_definitions?.value_type)) continue;
    if (typeof r.value !== "number" || !Number.isFinite(r.value)) continue;
    const n = testName(r);
    const cur = m.get(n) || { sum: 0, count: 0, unit: r.test_definitions?.unit || "" };
    cur.sum += r.value;
    cur.count += 1;
    m.set(n, cur);
  }
  const out: Record<string, { avg: number; unit: string }> = {};
  m.forEach((v, k) => {
    out[k] = { avg: v.count ? v.sum / v.count : 0, unit: v.unit };
  });
  return out;
}

const LINE_COLORS = ["var(--peaker-ui-PRIMARY)", "#22d3ee", "#f59e0b", "#ef4444", "#22c55e", "#a78bfa", "#fb7185"];

function FieldTestResultValue({ row }: { row: FieldTestResultRow }) {
  const display = fieldTestResultRowDisplay({
    value: row.value,
    value_text: row.value_text,
    value_type: row.test_definitions?.value_type,
  });

  if (display.kind === "empty") {
    return <span className="text-xl font-black italic text-gray-600">—</span>;
  }

  if (display.kind === "text") {
    return (
      <p
        className="min-w-0 text-sm font-semibold normal-case leading-relaxed text-white break-words [overflow-wrap:anywhere] line-clamp-6"
        title={display.value}
      >
        {display.value}
      </p>
    );
  }

  return (
    <div className="min-w-0 text-xl font-black italic text-white break-words">
      {display.integerPart}
      {display.decimalPart ? (
        <>
          <span className="text-xs opacity-80">.{display.decimalPart}</span>
        </>
      ) : null}
      <span className="ml-1 text-[10px] text-[color:var(--peaker-ui-PRIMARY)] not-italic uppercase">{row.test_definitions?.unit}</span>
    </div>
  );
}

export function AthleteFieldTestsPanel({
  results,
  athleteId,
  athleteName,
  heightCm,
  weightKg,
}: {
  results: FieldTestResultRow[];
  athleteId: string;
  athleteName: string;
  heightCm?: number | null;
  weightKg?: number | null;
}) {
  const allNames = useMemo(() => Array.from(new Set(results.map(testName))).sort(), [results]);

  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [compareOn, setCompareOn] = useState(false);
  const [cmpFrom, setCmpFrom] = useState("");
  const [cmpTo, setCmpTo] = useState("");
  const [selectedTests, setSelectedTests] = useState<string[] | null>(null);
  const [view, setView] = useState<"grafik" | "tablo">("tablo");

  const effectiveSelectedTests = useMemo(
    () => resolveAthleteFieldTestSelectedNames(allNames, selectedTests),
    [allNames, selectedTests]
  );

  const effectiveRange = useMemo(
    () => resolveAthleteFieldTestDateRange(results, rangeFrom, rangeTo),
    [results, rangeFrom, rangeTo]
  );

  const filtered = useMemo(() => {
    if (!effectiveRange.from && !effectiveRange.to) return results;
    return results.filter((r) => inDateRange(r.test_date, effectiveRange.from, effectiveRange.to));
  }, [results, effectiveRange.from, effectiveRange.to]);

  const filteredByTests = useMemo(() => {
    return filtered.filter((r) => effectiveSelectedTests.includes(testName(r)));
  }, [filtered, effectiveSelectedTests]);

  const rowsSorted = useMemo(() => {
    return [...filteredByTests].sort((a, b) => dayKey(b.test_date).localeCompare(dayKey(a.test_date)));
  }, [filteredByTests]);

  const chartData = useMemo(() => {
    const numericRows = filteredByTests.filter(
      (r) => !isTextMetricValueType(r.test_definitions?.value_type) && typeof r.value === "number" && Number.isFinite(r.value)
    );
    const daySet = new Set<string>();
    for (const r of numericRows) {
      daySet.add(dayKey(r.test_date));
    }
    const days = Array.from(daySet).sort();
    return days.map((dt) => {
      const point: Record<string, string | number> = {
        tarih: dt,
        tarihLabel: new Date(`${dt}T12:00:00`).toLocaleDateString("tr-TR"),
      };
      for (const name of effectiveSelectedTests) {
        const same = numericRows.filter((r) => dayKey(r.test_date) === dt && testName(r) === name);
        if (same.length === 0) continue;
        const avg = same.reduce((s, x) => s + (x.value || 0), 0) / same.length;
        point[name] = Math.round(avg * 100) / 100;
      }
      return point;
    });
  }, [filteredByTests, effectiveSelectedTests]);

  const compareRows = useMemo(() => {
    if (!compareOn || !cmpFrom || !cmpTo || !effectiveRange.from || !effectiveRange.to) return null;
    const aRows = results.filter(
      (r) =>
        inDateRange(r.test_date, effectiveRange.from, effectiveRange.to) &&
        effectiveSelectedTests.includes(testName(r))
    );
    const bRows = results.filter(
      (r) => inDateRange(r.test_date, cmpFrom, cmpTo) && effectiveSelectedTests.includes(testName(r))
    );
    const avgA = aggregateAvgByTest(aRows);
    const avgB = aggregateAvgByTest(bRows);
    const names = new Set([...Object.keys(avgA), ...Object.keys(avgB)]);
    return [...names].sort().map((n) => {
      const va = avgA[n]?.avg;
      const vb = avgB[n]?.avg;
      const diff = va != null && vb != null ? Math.round((vb - va) * 100) / 100 : null;
      return { name: n, unit: avgA[n]?.unit || avgB[n]?.unit || "", avgA: va, avgB: vb, diff };
    });
  }, [compareOn, cmpFrom, cmpTo, results, effectiveRange.from, effectiveRange.to, effectiveSelectedTests]);

  const toggleTest = (n: string) => {
    setSelectedTests((prev) => {
      const current = resolveAthleteFieldTestSelectedNames(allNames, prev);
      return current.includes(n) ? current.filter((x) => x !== n) : [...current, n];
    });
  };

  return (
    <div
      id="alan-testleri"
      className="min-w-0 overflow-hidden rounded-2xl border border-white/5 ui-card shadow-xl md:rounded-3xl"
    >
      <div className="p-5 md:p-7 border-b border-white/5 flex flex-col gap-5 md:gap-6 bg-white/[0.01] min-w-0">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 min-w-0">
          <div className="flex items-start gap-4 min-w-0">
            <div className="shrink-0 rounded-xl bg-[color-mix(in_srgb,var(--peaker-ui-PRIMARY)_10%,transparent)] p-2 text-[color:var(--peaker-ui-PRIMARY)]">
              <History size={18} aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm md:text-base font-black italic uppercase tracking-tight text-white break-words">
                Saha <span className="text-[color:var(--peaker-ui-PRIMARY)]">Test Geçmişi</span>
              </h3>
              <p className="text-[8px] font-black text-gray-600 uppercase tracking-[0.2em] sm:tracking-[0.3em] mt-1 italic leading-relaxed break-words">
                Tarih aralığı · metrik seçimi · grafik veya tablo · iki dönem kıyası
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setView("tablo")}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-[9px] font-black uppercase tracking-widest transition-all touch-manipulation sm:px-5 ${
                view === "tablo"
                  ? "ui-tabs-nav__tab--active text-white"
                  : "ui-tabs-nav__tab--inactive text-gray-500 sm:hover:border-[color-mix(in_srgb,var(--peaker-ui-PRIMARY)_40%,transparent)]"
              }`}
            >
              <Table2 size={14} aria-hidden /> Tablo
            </button>
            <button
              type="button"
              onClick={() => setView("grafik")}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-[9px] font-black uppercase tracking-widest transition-all touch-manipulation sm:px-5 ${
                view === "grafik"
                  ? "ui-tabs-nav__tab--active text-white"
                  : "ui-tabs-nav__tab--inactive text-gray-500 sm:hover:border-[color-mix(in_srgb,var(--peaker-ui-PRIMARY)_40%,transparent)]"
              }`}
            >
              <LineChartIcon size={14} aria-hidden /> Grafik
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 lg:gap-8 min-w-0">
          <div className="flex shrink-0 items-center gap-2 text-[color:var(--peaker-ui-PRIMARY)]">
            <Calendar size={14} aria-hidden />
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Ana aralık</span>
          </div>
          <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 text-[10px] font-bold text-gray-400 min-w-0 flex-1 sm:flex-initial">
            <span className="shrink-0">Başlangıç</span>
            <input
              type="date"
              value={rangeFrom || effectiveRange.from}
              onChange={(e) => setRangeFrom(e.target.value)}
              className="min-h-11 w-full min-w-0 touch-manipulation ui-input px-3 py-2.5 text-base text-white outline-none focus:border-[color:var(--peaker-ui-PRIMARY)] sm:min-h-0 sm:py-2 sm:text-xs"
            />
          </label>
          <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 text-[10px] font-bold text-gray-400 min-w-0 flex-1 sm:flex-initial">
            <span className="shrink-0">Bitiş</span>
            <input
              type="date"
              value={rangeTo || effectiveRange.to}
              onChange={(e) => setRangeTo(e.target.value)}
              className="min-h-11 w-full min-w-0 touch-manipulation ui-input px-3 py-2.5 text-base text-white outline-none focus:border-[color:var(--peaker-ui-PRIMARY)] sm:min-h-0 sm:py-2 sm:text-xs"
            />
          </label>
        </div>

        <div className="space-y-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-gray-600 italic">Gösterilecek metrikler</p>
          <div className="flex flex-wrap gap-2">
            {allNames.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => toggleTest(n)}
                className={`px-3 sm:px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-wide border transition-all touch-manipulation text-left break-words max-w-full ${
                  effectiveSelectedTests.includes(n)
                    ? "bg-[color-mix(in_srgb,var(--peaker-ui-PRIMARY)_20%,transparent)] border-[color-mix(in_srgb,var(--peaker-ui-PRIMARY)_50%,transparent)] text-white"
                    : "ui-tabs-nav__tab--inactive text-gray-600 line-through decoration-gray-600"
                }`}
              >
                {n}
              </button>
            ))}
            {allNames.length === 0 && (
              <span className="text-[10px] text-gray-600 font-bold italic">Kayıtlı saha testi yok</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-3xl ui-card-inner p-5 md:flex-row md:items-center">
          <label className="flex min-h-11 cursor-pointer touch-manipulation items-center gap-3">
            <input
              type="checkbox"
              checked={compareOn}
              onChange={(e) => setCompareOn(e.target.checked)}
              className="h-5 w-5 shrink-0 rounded accent-[var(--peaker-ui-PRIMARY)]"
            />
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <GitCompare size={14} className="text-[color:var(--peaker-ui-PRIMARY)]" aria-hidden /> İki dönem kıyası (ortalama)
            </span>
          </label>
          {compareOn && (
            <div className="flex flex-wrap gap-4 md:ml-auto">
              <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 text-[10px] font-bold text-gray-400 min-w-0">
                <span className="shrink-0">Kıyas B başlangıç</span>
                <input
                  type="date"
                  value={cmpFrom}
                  onChange={(e) => setCmpFrom(e.target.value)}
                  className="min-h-11 w-full min-w-0 touch-manipulation ui-input px-3 py-2.5 text-base text-white outline-none focus:border-[color:var(--peaker-ui-PRIMARY)] sm:min-h-0 sm:py-2 sm:text-xs"
                />
              </label>
              <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 text-[10px] font-bold text-gray-400 min-w-0">
                <span className="shrink-0">Kıyas B bitiş</span>
                <input
                  type="date"
                  value={cmpTo}
                  onChange={(e) => setCmpTo(e.target.value)}
                  className="min-h-11 w-full min-w-0 touch-manipulation ui-input px-3 py-2.5 text-base text-white outline-none focus:border-[color:var(--peaker-ui-PRIMARY)] sm:min-h-0 sm:py-2 sm:text-xs"
                />
              </label>
            </div>
          )}
        </div>

        {athleteId ? (
          <AthleteFieldTestPdfExport
            athleteId={athleteId}
            athleteName={athleteName}
            heightCm={heightCm}
            weightKg={weightKg}
            testDates={results.map((r) => r.test_date)}
          />
        ) : null}
      </div>

      {compareOn && compareRows && compareRows.length > 0 && (
        <div className="p-5 md:p-6 border-b border-white/5 overflow-x-auto min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-gray-500 mb-4 italic break-words">
            Ortalama kıyas: A = ana aralık ({rangeFrom} – {rangeTo}) · B = kıyas aralığı ({cmpFrom} – {cmpTo})
          </p>
          <DataTable
            bare
            scrollClassName=""
            tableClassName="w-full text-left text-sm min-w-[520px]"
            headClassName="ui-table-head ui-table-head--divided text-[9px] font-black uppercase tracking-widest"
            head={
              <tr>
                <th className={`${uiTableThClass} py-3 pr-4`}>Metrik</th>
                <th className={`${uiTableThClass} py-3 pr-4`}>Ort. A</th>
                <th className={`${uiTableThClass} py-3 pr-4`}>Ort. B</th>
                <th className={`${uiTableThClass} py-3`}>Fark (B − A)</th>
              </tr>
            }
          >
            {compareRows.map((row) => (
              <tr key={row.name} className={`${uiTableRowHoverClass} font-black italic text-white`}>
                <td className={`${uiTableTdClass} min-w-0 max-w-[12rem] break-words py-4 pr-4 text-[11px] sm:max-w-none`}>
                  {row.name}{" "}
                  <span className="text-[9px] not-italic text-[color:var(--peaker-ui-PRIMARY)] uppercase">{row.unit}</span>
                </td>
                <td className={`${uiTableTdClass} py-4 pr-4 tabular-nums`}>{row.avgA != null ? row.avgA.toFixed(2) : "—"}</td>
                <td className={`${uiTableTdClass} py-4 pr-4 tabular-nums`}>{row.avgB != null ? row.avgB.toFixed(2) : "—"}</td>
                <td
                  className={`${uiTableTdClass} py-4 tabular-nums ${
                    row.diff == null ? "text-gray-600" : row.diff > 0 ? "text-emerald-400" : row.diff < 0 ? "text-amber-400" : "text-gray-400"
                  }`}
                >
                  {row.diff != null ? (row.diff > 0 ? `+${row.diff}` : String(row.diff)) : "—"}
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}

      <div className="p-4 md:p-6 min-w-0">
        {view === "grafik" && chartData.length > 0 && effectiveSelectedTests.some((n) => chartData.some((row) => row[n] != null)) ? (
          <div className="h-[240px] sm:h-[280px] md:h-[300px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                <XAxis dataKey="tarihLabel" tick={{ fill: "#6b7280", fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#6b7280", fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1c1c21",
                    border: "1px solid rgba(124,58,237,0.25)",
                    borderRadius: "16px",
                    fontSize: "11px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "10px", fontWeight: 800 }} />
                {effectiveSelectedTests.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : view === "grafik" ? (
          <p className="text-center text-[10px] font-black uppercase tracking-widest text-gray-600 py-20 italic">
            Grafik için bu aralıkta veri yok veya metrik seçilmedi
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-white/5 rounded-[2rem] overflow-hidden border border-white/5 min-w-0">
            {rowsSorted.length > 0 ? (
              rowsSorted.map((m, idx) => (
                <div
                  key={`${m.test_date}-${testName(m)}-${idx}`}
                  className="min-w-0 overflow-hidden ui-card p-5 transition-all sm:hover:bg-[color-mix(in_srgb,var(--peaker-ui-PRIMARY)_5%,transparent)]"
                >
                  <div className="mb-3 flex items-center gap-2 min-w-0">
                    <Calendar size={12} className="shrink-0 text-gray-600" aria-hidden />
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest truncate">
                      {new Date(m.test_date).toLocaleDateString("tr-TR")}
                    </span>
                  </div>
                  <FieldTestResultValue row={m} />
                  <div className="mt-2 break-words text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                    {testName(m)}
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full p-12 text-center text-[10px] font-black uppercase italic tracking-widest text-gray-600 sm:p-24">
                Seçilen filtrelere uygun kayıt yok
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
