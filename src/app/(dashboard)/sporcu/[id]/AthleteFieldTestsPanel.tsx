"use client";

import { useMemo, useState, useEffect } from "react";
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
    if ((r.test_definitions?.value_type || "number") !== "number") continue;
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

const LINE_COLORS = ["#7c3aed", "#22d3ee", "#f59e0b", "#ef4444", "#22c55e", "#a78bfa", "#fb7185"];

export function AthleteFieldTestsPanel({ results }: { results: FieldTestResultRow[] }) {
  const allNames = useMemo(() => Array.from(new Set(results.map(testName))).sort(), [results]);

  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [compareOn, setCompareOn] = useState(false);
  const [cmpFrom, setCmpFrom] = useState("");
  const [cmpTo, setCmpTo] = useState("");
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [view, setView] = useState<"grafik" | "tablo">("tablo");

  useEffect(() => {
    const id = setTimeout(() => {
      if (allNames.length === 0) {
        setSelectedTests([]);
        return;
      }
      setSelectedTests((prev) => {
        const valid = prev.filter((p) => allNames.includes(p));
        if (valid.length > 0) return valid;
        return [...allNames];
      });
    }, 0);
    return () => clearTimeout(id);
  }, [allNames]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (results.length === 0) return;
      if (rangeFrom || rangeTo) return;
      const days = results.map((r) => dayKey(r.test_date)).filter(Boolean);
      if (days.length === 0) return;
      const sorted = [...days].sort();
      setRangeFrom(sorted[0]!);
      setRangeTo(sorted[sorted.length - 1]!);
    }, 0);
    return () => clearTimeout(id);
  }, [results, rangeFrom, rangeTo]);

  const filtered = useMemo(() => {
    if (!rangeFrom && !rangeTo) return results;
    return results.filter((r) => inDateRange(r.test_date, rangeFrom, rangeTo));
  }, [results, rangeFrom, rangeTo]);

  const filteredByTests = useMemo(() => {
    return filtered.filter((r) => selectedTests.includes(testName(r)));
  }, [filtered, selectedTests]);

  const rowsSorted = useMemo(() => {
    return [...filteredByTests].sort((a, b) => dayKey(b.test_date).localeCompare(dayKey(a.test_date)));
  }, [filteredByTests]);

  const chartData = useMemo(() => {
    const numericRows = filteredByTests.filter(
      (r) => (r.test_definitions?.value_type || "number") === "number" && typeof r.value === "number" && Number.isFinite(r.value)
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
      for (const name of selectedTests) {
        const same = numericRows.filter((r) => dayKey(r.test_date) === dt && testName(r) === name);
        if (same.length === 0) continue;
        const avg = same.reduce((s, x) => s + (x.value || 0), 0) / same.length;
        point[name] = Math.round(avg * 100) / 100;
      }
      return point;
    });
  }, [filteredByTests, selectedTests]);

  const compareRows = useMemo(() => {
    if (!compareOn || !cmpFrom || !cmpTo || !rangeFrom || !rangeTo) return null;
    const aRows = results.filter(
      (r) => inDateRange(r.test_date, rangeFrom, rangeTo) && selectedTests.includes(testName(r))
    );
    const bRows = results.filter(
      (r) => inDateRange(r.test_date, cmpFrom, cmpTo) && selectedTests.includes(testName(r))
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
  }, [compareOn, cmpFrom, cmpTo, results, rangeFrom, rangeTo, selectedTests]);

  const toggleTest = (n: string) => {
    setSelectedTests((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  };

  return (
    <div
      id="alan-testleri"
      className="min-w-0 overflow-hidden rounded-2xl border border-white/5 bg-[#121215] shadow-xl md:rounded-3xl"
    >
      <div className="p-5 md:p-7 border-b border-white/5 flex flex-col gap-5 md:gap-6 bg-white/[0.01] min-w-0">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 min-w-0">
          <div className="flex items-start gap-4 min-w-0">
            <div className="shrink-0 rounded-xl bg-[#7c3aed]/10 p-2 text-[#7c3aed]">
              <History size={18} aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm md:text-base font-black italic uppercase tracking-tight text-white break-words">
                Saha <span className="text-[#7c3aed]">Test Geçmişi</span>
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
                  ? "bg-[#7c3aed] border-[#7c3aed] text-white"
                  : "border-white/10 bg-black/40 text-gray-500 sm:hover:border-[#7c3aed]/40"
              }`}
            >
              <Table2 size={14} aria-hidden /> Tablo
            </button>
            <button
              type="button"
              onClick={() => setView("grafik")}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-[9px] font-black uppercase tracking-widest transition-all touch-manipulation sm:px-5 ${
                view === "grafik"
                  ? "bg-[#7c3aed] border-[#7c3aed] text-white"
                  : "border-white/10 bg-black/40 text-gray-500 sm:hover:border-[#7c3aed]/40"
              }`}
            >
              <LineChartIcon size={14} aria-hidden /> Grafik
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 lg:gap-8 min-w-0">
          <div className="flex shrink-0 items-center gap-2 text-[#7c3aed]">
            <Calendar size={14} aria-hidden />
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Ana aralık</span>
          </div>
          <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 text-[10px] font-bold text-gray-400 min-w-0 flex-1 sm:flex-initial">
            <span className="shrink-0">Başlangıç</span>
            <input
              type="date"
              value={rangeFrom}
              onChange={(e) => setRangeFrom(e.target.value)}
              className="min-h-11 w-full min-w-0 touch-manipulation rounded-xl border border-white/10 bg-black px-3 py-2.5 text-base text-white outline-none focus:border-[#7c3aed] sm:min-h-0 sm:py-2 sm:text-xs"
            />
          </label>
          <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 text-[10px] font-bold text-gray-400 min-w-0 flex-1 sm:flex-initial">
            <span className="shrink-0">Bitiş</span>
            <input
              type="date"
              value={rangeTo}
              onChange={(e) => setRangeTo(e.target.value)}
              className="min-h-11 w-full min-w-0 touch-manipulation rounded-xl border border-white/10 bg-black px-3 py-2.5 text-base text-white outline-none focus:border-[#7c3aed] sm:min-h-0 sm:py-2 sm:text-xs"
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
                  selectedTests.includes(n)
                    ? "bg-[#7c3aed]/20 border-[#7c3aed]/50 text-white"
                    : "bg-black/30 border-white/10 text-gray-600 line-through decoration-gray-600"
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

        <div className="flex flex-col gap-4 rounded-3xl border border-white/5 bg-black/30 p-5 md:flex-row md:items-center">
          <label className="flex min-h-11 cursor-pointer touch-manipulation items-center gap-3">
            <input
              type="checkbox"
              checked={compareOn}
              onChange={(e) => setCompareOn(e.target.checked)}
              className="h-5 w-5 shrink-0 rounded accent-[#7c3aed]"
            />
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
              <GitCompare size={14} className="text-[#7c3aed]" aria-hidden /> İki dönem kıyası (ortalama)
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
                  className="min-h-11 w-full min-w-0 touch-manipulation rounded-xl border border-white/10 bg-black px-3 py-2.5 text-base text-white outline-none focus:border-[#7c3aed] sm:min-h-0 sm:py-2 sm:text-xs"
                />
              </label>
              <label className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2 text-[10px] font-bold text-gray-400 min-w-0">
                <span className="shrink-0">Kıyas B bitiş</span>
                <input
                  type="date"
                  value={cmpTo}
                  onChange={(e) => setCmpTo(e.target.value)}
                  className="min-h-11 w-full min-w-0 touch-manipulation rounded-xl border border-white/10 bg-black px-3 py-2.5 text-base text-white outline-none focus:border-[#7c3aed] sm:min-h-0 sm:py-2 sm:text-xs"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {compareOn && compareRows && compareRows.length > 0 && (
        <div className="p-5 md:p-6 border-b border-white/5 overflow-x-auto min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-gray-500 mb-4 italic break-words">
            Ortalama kıyas: A = ana aralık ({rangeFrom} – {rangeTo}) · B = kıyas aralığı ({cmpFrom} – {cmpTo})
          </p>
          <table className="w-full text-left text-sm min-w-[520px]">
            <thead>
              <tr className="border-b border-white/10 text-[9px] font-black uppercase tracking-widest text-gray-500">
                <th className="py-3 pr-4">Metrik</th>
                <th className="py-3 pr-4">Ort. A</th>
                <th className="py-3 pr-4">Ort. B</th>
                <th className="py-3">Fark (B − A)</th>
              </tr>
            </thead>
            <tbody>
              {compareRows.map((row) => (
                <tr key={row.name} className="border-b border-white/5 text-white font-black italic">
                  <td className="min-w-0 max-w-[12rem] break-words py-4 pr-4 text-[11px] sm:max-w-none">
                    {row.name}{" "}
                    <span className="text-[9px] not-italic text-[#7c3aed] uppercase">{row.unit}</span>
                  </td>
                  <td className="py-4 pr-4 tabular-nums">{row.avgA != null ? row.avgA.toFixed(2) : "—"}</td>
                  <td className="py-4 pr-4 tabular-nums">{row.avgB != null ? row.avgB.toFixed(2) : "—"}</td>
                  <td
                    className={`py-4 tabular-nums ${
                      row.diff == null ? "text-gray-600" : row.diff > 0 ? "text-emerald-400" : row.diff < 0 ? "text-amber-400" : "text-gray-400"
                    }`}
                  >
                    {row.diff != null ? (row.diff > 0 ? `+${row.diff}` : String(row.diff)) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="p-4 md:p-6 min-w-0">
        {view === "grafik" && chartData.length > 0 && selectedTests.some((n) => chartData.some((row) => row[n] != null)) ? (
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
                {selectedTests.map((name, i) => (
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-white/5 rounded-[2rem] overflow-hidden border border-white/5">
            {rowsSorted.length > 0 ? (
              rowsSorted.map((m, idx) => (
                <div key={`${m.test_date}-${testName(m)}-${idx}`} className="bg-[#121215] p-5 transition-all sm:hover:bg-[#7c3aed]/5">
                  <div className="mb-3 flex items-center gap-2">
                    <Calendar size={12} className="text-gray-600" aria-hidden />
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                      {new Date(m.test_date).toLocaleDateString("tr-TR")}
                    </span>
                  </div>
                  <div className="text-xl font-black italic text-white">
                    {(m.test_definitions?.value_type || "number") === "text"
                      ? (m.value_text || "—")
                      : m.value}
                    {(m.test_definitions?.value_type || "number") === "number" ? (
                      <span className="text-[10px] text-[#7c3aed] not-italic uppercase">{m.test_definitions?.unit}</span>
                    ) : null}
                  </div>
                  <div className="mt-2 break-words text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">{testName(m)}</div>
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
