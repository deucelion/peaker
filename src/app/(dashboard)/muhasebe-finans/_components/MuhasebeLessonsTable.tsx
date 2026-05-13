"use client";

import EmptyState from "@/components/ui/EmptyState";
import type { AccountingFinanceSnapshot } from "@/lib/actions/accountingFinanceActions";
import {
  getAccountingLessonStatusLabel,
  getAccountingLessonTypeLabel,
} from "@/lib/accountingFinance/labels";

type LessonRow = AccountingFinanceSnapshot["lessons"][number];

function formatShortDateTime(value: string) {
  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function lessonStatusBadgeClass(status: string) {
  if (status === "completed") return "border-emerald-500/35 bg-emerald-500/10 text-emerald-200";
  if (status === "cancelled") return "border-red-500/35 bg-red-500/10 text-red-200";
  return "border-white/15 bg-white/5 text-gray-300";
}

export type MuhasebeLessonsTableProps = {
  rows: LessonRow[];
  title: string;
  onResetFilters: () => void;
  onGoLessonManagement: () => void;
};

export function MuhasebeLessonsTable({ rows, title, onResetFilters, onGoLessonManagement }: MuhasebeLessonsTableProps) {
  const isEmpty = rows.length === 0;
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <h2 className="text-sm font-black uppercase text-white">{title}</h2>
        <p className="text-[11px] font-semibold text-gray-500">{rows.length} kayıt</p>
      </div>
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <article key={`${row.sourceType}-${row.id}`} className="rounded-2xl border border-white/10 bg-[#121215] p-4">
            <p className="text-sm font-black text-white">{row.title}</p>
            <p className="mt-1 text-[11px] font-semibold text-gray-500">{formatShortDateTime(row.startsAt)}</p>
            <div className="mt-3 space-y-1 text-[11px] font-semibold">
              <p className="text-gray-400">
                {getAccountingLessonTypeLabel(row.sourceType)} ·{" "}
                <span className={`inline-flex rounded-full border px-2 py-0.5 ${lessonStatusBadgeClass(row.status)}`}>
                  {getAccountingLessonStatusLabel(row.status)}
                </span>
              </p>
              <p className="text-gray-400">
                Koç: <span className="text-gray-200">{row.coachName}</span>
              </p>
              <p className="text-gray-400">
                Lokasyon: <span className="text-gray-200">{row.location || "—"}</span>
              </p>
              <p className="text-gray-400">
                Katılımcı: <span className="text-gray-200">{row.participantCount}</span>
              </p>
            </div>
          </article>
        ))}
        {isEmpty ? (
          <EmptyState
            variant="filtered_empty"
            title="Bu aralıkta ders kaydı yok"
            description="Filtreleri değiştirebilir veya ders yönetiminden ders oluşturabilirsiniz."
            primaryAction={{ label: "Filtreleri sıfırla", onClick: onResetFilters }}
            secondaryAction={{ label: "Ders yönetimi", onClick: onGoLessonManagement }}
            compact
          />
        ) : null}
      </div>
      <div className="hidden overflow-x-auto rounded-2xl border border-white/10 bg-[#121215] md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 text-[10px] uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Ders</th>
              <th className="px-3 py-2">Tür</th>
              <th className="px-3 py-2">Tarih & Saat</th>
              <th className="px-3 py-2">Koç</th>
              <th className="px-3 py-2">Lokasyon</th>
              <th className="px-3 py-2">Durum</th>
              <th className="px-3 py-2 text-right">Katılımcı</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.sourceType}-${row.id}`} className="border-b border-white/5 text-xs text-gray-200 hover:bg-white/[0.04]">
                <td className="px-3 py-2">{row.title}</td>
                <td className="px-3 py-2">{getAccountingLessonTypeLabel(row.sourceType)}</td>
                <td className="px-3 py-2">{formatShortDateTime(row.startsAt)}</td>
                <td className="px-3 py-2">{row.coachName}</td>
                <td className="px-3 py-2">{row.location || "—"}</td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${lessonStatusBadgeClass(row.status)}`}>
                    {getAccountingLessonStatusLabel(row.status)}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{row.participantCount}</td>
              </tr>
            ))}
            {isEmpty ? (
              <tr>
                <td colSpan={7} className="px-3 py-8">
                  <EmptyState
                    variant="filtered_empty"
                    title="Bu aralıkta ders kaydı yok"
                    description="Filtreleri değiştirebilir veya ders yönetiminden ders oluşturabilirsiniz."
                    primaryAction={{ label: "Filtreleri sıfırla", onClick: onResetFilters }}
                    secondaryAction={{ label: "Ders yönetimi", onClick: onGoLessonManagement }}
                    bare
                  />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
