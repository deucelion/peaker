"use client";

import { useEffect, useMemo, useState } from "react";
import { Ban, Loader2, Pencil, X } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { DataTablePagination } from "@/components/ui/data-display";
import type { AccountingFinancePaymentRow } from "@/lib/actions/accountingFinanceActions";
import {
  cancelPaymentRecord,
  correctPaymentRecord,
  voidPrivateLessonLedgerPayment,
  correctPrivateLessonLedgerPayment,
} from "@/lib/actions/paymentRecordActions";
import { isUuid } from "@/lib/validation/uuid";
import { parseTRYMoneyInput } from "@/lib/privateLessons/packageMath";
import {
  getAccountingPaymentKindLabel,
  getAccountingPaymentRowStatusBadgeClass,
  getAccountingPaymentRowStatusLabel,
  getPackageLifecycleLabel,
} from "@/lib/accountingFinance/labels";

const PAYMENTS_PAGE_SIZE = 50;

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

function rowIsAdjustable(row: AccountingFinancePaymentRow): boolean {
  if (row.ledgerRowId && isUuid(row.ledgerRowId)) return true;
  return isUuid(row.id);
}

type DialogState =
  | { mode: "cancel" | "correct"; row: AccountingFinancePaymentRow; isLedger: boolean }
  | null;

export type MuhasebePaymentsTableProps = {
  rows: AccountingFinancePaymentRow[];
  onAddPayment: () => void;
  onResetFilters: () => void;
  /** Yönetici: tahsilat iptal/düzelt (sunucu yine guard uygular) */
  canAdjustRecords?: boolean;
  onRecordsAdjusted?: () => void;
};

export function MuhasebePaymentsTable({
  rows,
  onAddPayment,
  onResetFilters,
  canAdjustRecords = false,
  onRecordsAdjusted,
}: MuhasebePaymentsTableProps) {
  const isEmpty = rows.length === 0;
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [reason, setReason] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage((p) => (p === 1 ? p : 1));
  }, [rows]);

  function resetAdjustForm() {
    setReason("");
    setNewAmount("");
    setLocalError(null);
    setBusy(false);
  }

  function openAdjustDialog(next: NonNullable<DialogState>) {
    resetAdjustForm();
    setDialog(next);
  }

  function closeAdjustDialog() {
    resetAdjustForm();
    setDialog(null);
  }

  const visibleRows = useMemo(() => {
    const start = (page - 1) * PAYMENTS_PAGE_SIZE;
    return rows.slice(start, start + PAYMENTS_PAGE_SIZE);
  }, [rows, page]);

  async function submitDialog() {
    if (!dialog) return;
    const r = reason.trim();
    if (r.length < 3) {
      setLocalError("Neden en az 3 karakter olmalıdır.");
      return;
    }
    const isLedger = dialog.isLedger;
    setBusy(true);
    setLocalError(null);

    if (dialog.mode === "cancel") {
      const fd = new FormData();
      fd.append("reason", r);
      if (isLedger) {
        fd.append("plpId", dialog.row.ledgerRowId!);
        const res = await voidPrivateLessonLedgerPayment(fd);
        setBusy(false);
        if ("error" in res && res.error) {
          setLocalError(res.error);
          return;
        }
      } else {
        fd.append("paymentId", dialog.row.id);
        const res = await cancelPaymentRecord(fd);
        setBusy(false);
        if ("error" in res && res.error) {
          setLocalError(res.error);
          return;
        }
      }
    } else {
      const parsed = parseTRYMoneyInput(newAmount);
      if (parsed == null || parsed <= 0) {
        setBusy(false);
        setLocalError("Geçerli yeni tutar girin.");
        return;
      }
      const fd = new FormData();
      fd.append("reason", r);
      fd.append("newAmount", String(parsed));
      if (isLedger) {
        fd.append("plpId", dialog.row.ledgerRowId!);
        const res = await correctPrivateLessonLedgerPayment(fd);
        setBusy(false);
        if ("error" in res && res.error) {
          setLocalError(res.error);
          return;
        }
      } else {
        fd.append("paymentId", dialog.row.id);
        const res = await correctPaymentRecord(fd);
        setBusy(false);
        if ("error" in res && res.error) {
          setLocalError(res.error);
          return;
        }
      }
    }

    closeAdjustDialog();
    onRecordsAdjusted?.();
  }

  const showOps = Boolean(canAdjustRecords);

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
            {showOps && rowIsAdjustable(row) ? (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-white/5 pt-3">
                <button
                  type="button"
                  onClick={() => openAdjustDialog({ mode: "cancel", row, isLedger: Boolean(row.ledgerRowId) })}
                  className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 text-[10px] font-black uppercase text-rose-200"
                >
                  <Ban className="size-3.5" aria-hidden />
                  İptal
                </button>
                {row.status === "odendi" ? (
                  <button
                    type="button"
                    onClick={() => openAdjustDialog({ mode: "correct", row, isLedger: Boolean(row.ledgerRowId) })}
                    className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 text-[10px] font-black uppercase text-amber-100"
                  >
                    <Pencil className="size-3.5" aria-hidden />
                    Düzelt
                  </button>
                ) : null}
              </div>
            ) : null}
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
              <th className="px-3 py-2">Paket durumu</th>
              <th className="px-3 py-2">Ödeme zamanı / kaynak</th>
              <th className="px-3 py-2 text-right">Ödenen</th>
              <th className="px-3 py-2 text-right">Kalan</th>
              <th className="px-3 py-2">Ödeme tarihi</th>
              <th className="px-3 py-2">Açıklama</th>
              <th className="px-3 py-2">Durum</th>
              {showOps ? <th className="px-3 py-2">İşlem</th> : null}
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
                <td className="px-3 py-2 text-[11px] text-gray-400">
                  {row.packageId ? getPackageLifecycleLabel(row.packageLifecycleStatus) : "—"}
                </td>
                <td className="max-w-[11rem] px-3 py-2 text-[11px] text-gray-300">{row.channelLabel}</td>
                <td className="px-3 py-2 text-right font-bold tabular-nums text-emerald-200/95">
                  {formatMoney(row.paidAmount)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-300">{formatRemainingBalanceCell(row)}</td>
                <td className="px-3 py-2">
                  {row.paymentDate ? new Date(row.paymentDate).toLocaleDateString("tr-TR") : "—"}
                </td>
                <td className="max-w-[14rem] px-3 py-2 text-[11px] text-gray-400">{row.descriptionText}</td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${getAccountingPaymentRowStatusBadgeClass(row)}`}
                  >
                    {getAccountingPaymentRowStatusLabel(row)}
                  </span>
                </td>
                {showOps ? (
                  <td className="px-3 py-2">
                    {rowIsAdjustable(row) ? (
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          title="Kayıt silinmez; iptal olarak işaretlenir (denetim izi kalır)."
                          onClick={() => openAdjustDialog({ mode: "cancel", row, isLedger: Boolean(row.ledgerRowId) })}
                          className="inline-flex items-center justify-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[9px] font-black uppercase text-rose-100"
                        >
                          <Ban className="size-3" aria-hidden />
                          İptal
                        </button>
                        {row.status === "odendi" ? (
                          <button
                            type="button"
                            title="Eski satır iptal + yeni tutarla kayıt (paket defteri için ayrı akış)."
                            onClick={() => openAdjustDialog({ mode: "correct", row, isLedger: Boolean(row.ledgerRowId) })}
                            className="inline-flex items-center justify-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[9px] font-black uppercase text-amber-100"
                          >
                            <Pencil className="size-3" aria-hidden />
                            Düzelt
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-600">—</span>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
            {isEmpty ? (
              <tr>
                <td colSpan={showOps ? 10 : 9} className="px-3 py-8">
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
        <DataTablePagination page={page} pageSize={PAYMENTS_PAGE_SIZE} total={rows.length} onChange={setPage} />
      ) : null}

      {dialog ? (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="presentation"
          onClick={() => !busy && closeAdjustDialog()}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#16161c] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-black uppercase text-white">
                {dialog.mode === "cancel"
                  ? dialog.isLedger
                    ? "Defter tahsilatını iptal et"
                    : "Tahsilat kaydını iptal et"
                  : dialog.isLedger
                    ? "Defter tahsilatını düzelt"
                    : "Tahsilat kaydını düzelt"}
              </h3>
              <button
                type="button"
                disabled={busy}
                onClick={() => closeAdjustDialog()}
                className="rounded-lg border border-white/10 p-2 text-gray-400"
                aria-label="Kapat"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <p className="mt-2 text-[11px] font-semibold text-gray-500">
              {dialog.mode === "cancel"
                ? "Kayıt veritabanından silinmez; iptal + zorunlu gerekçe denetim günlüğüne yazılır."
                : "Eski kayıt iptal edilir; düzeltilmiş tutar yeni satır olarak eklenir. Gerekçe zorunludur."}
            </p>
            <label className="mt-4 block text-[10px] font-bold text-gray-400">
              Gerekçe (en az 3 karakter)
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                disabled={busy}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>
            {dialog.mode === "correct" ? (
              <label className="mt-3 block text-[10px] font-bold text-gray-400">
                Yeni tutar (₺)
                <input
                  type="text"
                  inputMode="decimal"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  disabled={busy}
                  placeholder="örn. 1.250,00"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
            ) : null}
            {localError ? <p className="mt-2 text-[11px] font-bold text-rose-300">{localError}</p> : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={() => closeAdjustDialog()}
                className="min-h-11 rounded-xl border border-white/15 px-4 text-[10px] font-black uppercase text-gray-300"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitDialog()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-[10px] font-black uppercase text-white disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Onayla
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
