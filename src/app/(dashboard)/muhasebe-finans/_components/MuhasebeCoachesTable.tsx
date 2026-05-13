"use client";

import type { AccountingFinanceSnapshot } from "@/lib/actions/accountingFinanceActions";

type CoachAggregateRow = AccountingFinanceSnapshot["coachAggregates"][number];

function formatShortDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function MuhasebeCoachesTable({ rows }: { rows: CoachAggregateRow[] }) {
  const isEmpty = rows.length === 0;
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="text-sm font-black uppercase text-white">Koç bazlı özet</h2>
        <p className="text-[11px] font-semibold text-gray-500">{rows.length} koç</p>
      </div>
      <div className="hidden overflow-x-auto rounded-2xl border border-white/10 bg-[#121215] md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 text-[10px] uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Koç</th>
              <th className="px-3 py-2 text-right">Toplam</th>
              <th className="px-3 py-2 text-right">Grup</th>
              <th className="px-3 py-2 text-right">Özel</th>
              <th className="px-3 py-2 text-right">Tamamlanan</th>
              <th className="px-3 py-2 text-right">Planlanan</th>
              <th className="px-3 py-2 text-right">İptal</th>
              <th className="px-3 py-2">Son ders</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.coachId || row.coachName} className="border-b border-white/5 text-xs text-gray-200 hover:bg-white/[0.04]">
                <td className="px-3 py-2 font-semibold">{row.coachName}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.total.toLocaleString("tr-TR")}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.groupCount.toLocaleString("tr-TR")}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.privateCount.toLocaleString("tr-TR")}</td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-200/90">{row.completedCount.toLocaleString("tr-TR")}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.plannedCount.toLocaleString("tr-TR")}</td>
                <td className="px-3 py-2 text-right tabular-nums text-red-200/90">{row.cancelledCount.toLocaleString("tr-TR")}</td>
                <td className="px-3 py-2">{formatShortDate(row.lastLessonAt)}</td>
              </tr>
            ))}
            {isEmpty ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center">
                  <p className="text-xs font-bold text-gray-200">Bu filtrelerde koç ders kaydı yok</p>
                  <p className="mt-1 text-xs font-medium text-gray-500">
                    Dönemi değiştirebilir veya ders kayıtlarını kontrol edebilirsiniz.
                  </p>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <article key={row.coachId || row.coachName} className="rounded-xl border border-white/10 bg-[#121215] p-3 text-xs">
            <p className="font-black text-white">{row.coachName}</p>
            <p className="mt-1 text-[11px] text-gray-400">
              Toplam {row.total} · Grup {row.groupCount} · Özel {row.privateCount}
            </p>
            <p className="mt-1 text-[11px] text-gray-400">
              Tamamlanan {row.completedCount} · Planlanan {row.plannedCount} · İptal {row.cancelledCount}
            </p>
            <p className="mt-1 text-[11px] text-gray-500">Son ders: {formatShortDate(row.lastLessonAt)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
