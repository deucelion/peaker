"use client";

import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/ui/EmptyState";
import { DataTablePagination } from "@/components/ui/data-display";
import type { AccountingFinancePaymentRow } from "@/lib/actions/accountingFinanceActions";

const PAYMENTS_PAGE_SIZE = 50;
import {
  getAccountingPaymentKindLabel,
  getAccountingPaymentRowStatusBadgeClass,
  getAccountingPaymentRowStatusLabel,
} from "@/lib/accountingFinance/labels";

function formatMoney(value: number) {
  return `₺${value.toLocaleString("tr-TR")}`;
}

function getPaymentTuruBucket(kind: string): string {
  if (kind === "monthly_membership") return "Aylık üyelik";
  if (kind === "private_lesson_package") return "Özel ders paketi";
  return getAccountingPaymentKindLabel(kind);
}

function formatRemainingBalanceCell(row: AccountingFinancePaymentRow) {
  if (row.packageId != null && row.remainingBalance != null) {
    return formatMoney(row.remainingBalance);
  }
  return "—";
}

export type MuhasebePaymentsTableProps = {
  rows: AccountingFinancePaymentRow[];
  onAddPayment: () => void;
  onResetFilters: () => void;
};

export function MuhasebePaymentsTable({ rows, onAddPayment, onResetFilters }: MuhasebePaymentsTableProps) {
  const isEmpty = rows.length === 0;
  // Faz 11.6 — Client-side pagination via DataTablePagination primitive.
  // Server action zaten cap 10k uyguluyor; bu adım UI'ı 50 satırlık sayfalara
  // bölerek render maliyetini düşürür ve DataTable semantiği sağlar.
  const [page, setPage] = useState(1);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage((p) => (p === 1 ? p : 1));
  }, [rows]);
  const visibleRows = useMemo(() => {
    const start = (page - 1) * PAYMENTS_PAGE_SIZE;
    return rows.slice(start, start + PAYMENTS_PAGE_SIZE);
  }, [rows, page]);

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <h2 className="text-sm font-black uppercase text-white">Tahsilat Kayıtları</h2>
        <p className="text-[11px] font-semibold text-gray-500">{rows.length} kayıt</p>
      </div>

      <div className="space-y-3 md:hidden">
        {visibleRows.map((row) => (
          <article key={row.id} className="rounded-2xl border border-white/10 bg-[#121215] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-white">{row.athleteName}</p>
                <p className="mt-1 text-[11px] font-semibold text-gray-500">
                  {row.paymentDate ? new Date(row.paymentDate).toLocaleDateString("tr-TR") : "—"}
                </p>
              </div>
              <span
                className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${getAccountingPaymentRowStatusBadgeClass(row)}`}
              >
                {getAccountingPaymentRowStatusLabel(row)}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-semibold">
              <p className="text-gray-400">
                Tür: <span className="text-gray-200">{getPaymentTuruBucket(row.paymentKind)}</span>
              </p>
              <p className="text-right text-emerald-300">Ödenen {formatMoney(row.paidAmount)}</p>
              <p className="col-span-2 text-gray-400">
                Kanal: <span className="text-gray-300">{row.channelLabel}</span>
              </p>
              <p className="col-span-2 text-gray-400">
                Kalan: <span className="text-gray-300">{formatRemainingBalanceCell(row)}</span>
              </p>
              <p className="col-span-2 text-gray-400">
                Açıklama: <span className="text-gray-300">{row.descriptionText}</span>
              </p>
            </div>
          </article>
        ))}
        {isEmpty ? (
          <EmptyState
            variant="filtered_empty"
            title="Bu aralıkta tahsilat kaydı yok"
            description="Filtreleri değiştirebilir veya yeni tahsilat ekleyebilirsiniz."
            primaryAction={{ label: "Tahsilat ekle", onClick: onAddPayment }}
            secondaryAction={{ label: "Filtreleri sıfırla", onClick: onResetFilters }}
            compact
          />
        ) : null}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-white/10 bg-[#121215] md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 text-[10px] uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Sporcu</th>
              <th className="px-3 py-2">Ödeme türü</th>
              <th className="px-3 py-2">Ödeme zamanı / kaynak</th>
              <th className="px-3 py-2 text-right">Ödenen</th>
              <th className="px-3 py-2 text-right">Kalan</th>
              <th className="px-3 py-2">Ödeme tarihi</th>
              <th className="px-3 py-2">Açıklama</th>
              <th className="px-3 py-2">Durum</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id} className="border-b border-white/5 text-xs text-gray-200 transition-colors hover:bg-white/[0.04]">
                <td className="px-3 py-2">{row.athleteName}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-gray-300">
                    {getPaymentTuruBucket(row.paymentKind)}
                  </span>
                </td>
                <td className="max-w-[11rem] px-3 py-2 text-[11px] text-gray-300">{row.channelLabel}</td>
                <td className="px-3 py-2 text-right font-bold tabular-nums text-emerald-200/95">{formatMoney(row.paidAmount)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-300">{formatRemainingBalanceCell(row)}</td>
                <td className="px-3 py-2">{row.paymentDate ? new Date(row.paymentDate).toLocaleDateString("tr-TR") : "—"}</td>
                <td className="max-w-[14rem] px-3 py-2 text-[11px] text-gray-400">{row.descriptionText}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${getAccountingPaymentRowStatusBadgeClass(row)}`}
                  >
                    {getAccountingPaymentRowStatusLabel(row)}
                  </span>
                </td>
              </tr>
            ))}
            {isEmpty ? (
              <tr>
                <td colSpan={8} className="px-3 py-8">
                  <EmptyState
                    variant="filtered_empty"
                    title="Bu aralıkta tahsilat kaydı yok"
                    description="Filtreleri değiştirebilir veya yeni tahsilat ekleyebilirsiniz."
                    primaryAction={{ label: "Tahsilat ekle", onClick: onAddPayment }}
                    secondaryAction={{ label: "Filtreleri sıfırla", onClick: onResetFilters }}
                    bare
                  />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {!isEmpty && rows.length > PAYMENTS_PAGE_SIZE ? (
        <DataTablePagination
          page={page}
          pageSize={PAYMENTS_PAGE_SIZE}
          total={rows.length}
          onChange={setPage}
        />
      ) : null}
    </section>
  );
}
