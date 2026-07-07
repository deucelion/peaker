"use client";

import { ClipboardCheck } from "lucide-react";
import Link from "next/link";

/**
 * Faz 5.1 (kısmî) — Performans merkezindeki "Saha Testi Sinyali" mini kartı.
 * Behavior birebir korundu; yalnızca presentational ayrıştırma.
 */

export type FieldTestTrendStatus = "improved" | "regressed" | "stable" | "unknown" | "insufficient_data";

export type FieldTestSignalSummary = {
  totalMeasurements: number;
  distinctMetricCount: number;
  lastTestDate: string | null;
  sinceDays: number;
  trendCounts: {
    improved: number;
    regressed: number;
    stable: number;
    unknown: number;
    insufficient_data: number;
  };
  trendsTop: Array<{
    metricId: string;
    metricName: string;
    unit: string;
    status: FieldTestTrendStatus;
    lastValue: number | null;
    previousValue: number | null;
    changePercent: number | null;
  }>;
};

export function FieldTestSignalsCard({ signal }: { signal: FieldTestSignalSummary }) {
  const showTrendBar =
    signal.trendCounts.improved > 0 ||
    signal.trendCounts.regressed > 0 ||
    signal.trendCounts.stable > 0 ||
    signal.trendCounts.unknown > 0 ||
    signal.trendCounts.insufficient_data > 0;

  return (
    <section className="mt-3 rounded-2xl border border-cyan-400/25 bg-cyan-500/5 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-cyan-200">
        <ClipboardCheck size={14} className="text-cyan-300 shrink-0" aria-hidden />
        <span>Saha test sinyali · son {signal.sinceDays} gün</span>
        <span className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[9px] tracking-wider text-cyan-100">
          {signal.totalMeasurements} ölçüm
        </span>
        <span className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[9px] tracking-wider text-cyan-100">
          {signal.distinctMetricCount} metrik
        </span>
        {signal.lastTestDate ? (
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] tracking-wider text-gray-300">
            Son test: {signal.lastTestDate}
          </span>
        ) : null}
        <Link
          href="/saha-testleri"
          className="ml-auto rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[9px] tracking-wider text-cyan-100 hover:border-cyan-300/60"
        >
          Saha testlerine git →
        </Link>
        <Link
          href="/saha-testleri/genel-rapor"
          className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[9px] tracking-wider text-cyan-100 hover:border-cyan-300/60"
        >
          Takım raporu →
        </Link>
      </div>

      {showTrendBar && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] font-black uppercase tracking-widest">
          {signal.trendCounts.improved > 0 ? (
            <span className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">
              ↑ {signal.trendCounts.improved} gelişen
            </span>
          ) : null}
          {signal.trendCounts.regressed > 0 ? (
            <span className="rounded-md border border-red-500/35 bg-red-500/10 px-2 py-0.5 text-red-200">
              ↓ {signal.trendCounts.regressed} gerileyen
            </span>
          ) : null}
          {signal.trendCounts.stable > 0 ? (
            <span className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-gray-200">
              → {signal.trendCounts.stable} stabil
            </span>
          ) : null}
          {signal.trendCounts.unknown > 0 ? (
            <span
              className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-100"
              title="Metrik için iyileşme yönü tanımlı değil."
            >
              ? {signal.trendCounts.unknown} yorumlanamıyor
            </span>
          ) : null}
          {signal.trendCounts.insufficient_data > 0 ? (
            <span
              className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-gray-400"
              title="Karşılaştırma için yeterli ölçüm yok."
            >
              ⏳ {signal.trendCounts.insufficient_data} yetersiz
            </span>
          ) : null}
        </div>
      )}

      {signal.trendsTop.length > 0 && (
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {signal.trendsTop.map((t) => {
            const tone =
              t.status === "improved"
                ? "border-emerald-500/30 bg-emerald-500/[0.04] text-emerald-100"
                : t.status === "regressed"
                  ? "border-red-500/30 bg-red-500/[0.04] text-red-100"
                  : t.status === "stable"
                    ? "border-white/10 bg-white/[0.03] text-gray-200"
                    : "border-white/10 bg-white/[0.02] text-gray-400";
            const arrow =
              t.status === "improved"
                ? "↑"
                : t.status === "regressed"
                  ? "↓"
                  : t.status === "stable"
                    ? "→"
                    : "·";
            const valueText = t.lastValue !== null ? `${t.lastValue}${t.unit ? ` ${t.unit}` : ""}` : "—";
            const previousText =
              t.previousValue !== null
                ? `önceki: ${t.previousValue}${t.unit ? ` ${t.unit}` : ""}`
                : t.status === "insufficient_data"
                  ? "karşılaştırma için yeterli veri yok"
                  : t.status === "unknown"
                    ? "yorumlanamıyor"
                    : "";
            const pct = t.changePercent !== null ? `${t.changePercent > 0 ? "+" : ""}${t.changePercent.toFixed(1)}%` : null;
            return (
              <li
                key={t.metricId}
                className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-[10px] ${tone}`}
              >
                <span className="min-w-0 truncate font-bold">
                  <span className="mr-1" aria-hidden>
                    {arrow}
                  </span>
                  {t.metricName}
                </span>
                <span className="shrink-0 font-mono text-[10px] tabular-nums">
                  {valueText}
                  {pct ? <span className="ml-1 opacity-80">({pct})</span> : null}
                  {previousText ? <span className="ml-1 text-[9px] opacity-70">· {previousText}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default FieldTestSignalsCard;
