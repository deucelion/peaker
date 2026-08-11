"use client";

import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";
import { useEffect, useMemo, useState } from "react";
import { Ban, Loader2, MoreHorizontal, Pencil, X } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { DataTable, DataTablePagination, uiTableRowHoverClass, uiTableTdClass, uiTableThClass } from "@/components/ui/data-display";
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
import { OverlayDialog, OverlayFooter, OVERLAY_Z } from "@/components/ui/overlay";

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
  /** Super admin org bağlamı — düzeltme/iptal formuna eklenir */
  organizationId?: string;
  onRecordsAdjusted?: () => void;
};

export function MuhasebePaymentsTable({
  rows,
  onAddPayment,
  onResetFilters,
  canAdjustRecords = false,
  organizationId,
  onRecordsAdjusted,
}: MuhasebePaymentsTableProps) {
  const isEmpty = rows.length === 0;
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [reason, setReason] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [mobileMenuRowId, setMobileMenuRowId] = useState<string | null>(null);

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
      if (organizationId) fd.append("organizationId", organizationId);
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
      if (organizationId) fd.append("organizationId", organizationId);
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
          <article key={row.id} className="ui-card rounded-2xl p-4">
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
              <div className="relative mt-3 flex justify-end border-t border-white/5 pt-3">
                <button
                  type="button"
                  aria-label="Satır işlemleri"
                  aria-expanded={mobileMenuRowId === row.id}
                  onClick={() => setMobileMenuRowId((id) => (id === row.id ? null : row.id))}
                  className={`${uiBrandingClasses.button.ghost} inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-gray-300`}
                >
                  <MoreHorizontal size={16} aria-hidden />
                </button>
                {mobileMenuRowId === row.id ? (
                  <div className="ui-overlay-menu absolute bottom-full right-0 z-20 mb-2 min-w-[10rem] overflow-hidden rounded-xl py-1 shadow-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuRowId(null);
                        openAdjustDialog({ mode: "cancel", row, isLedger: Boolean(row.ledgerRowId) });
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] font-black uppercase text-rose-200 hover:bg-white/5"
                    >
                      <Ban className="size-3.5" aria-hidden />
                      İptal
                    </button>
                    {row.status === "odendi" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuRowId(null);
                          openAdjustDialog({ mode: "correct", row, isLedger: Boolean(row.ledgerRowId) });
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] font-black uppercase text-amber-100 hover:bg-white/5"
                      >
                        <Pencil className="size-3.5" aria-hidden />
                        Düzelt
                      </button>
                    ) : null}
                  </div>
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

      <div className="hidden md:block">
        <DataTable
          headClassName="ui-table-head ui-table-head--divided"
          tableClassName="text-sm"
          head={
            <tr>
              <th className={uiTableThClass}>Sporcu</th>
              <th className={uiTableThClass}>Ödeme türü</th>
              <th className={uiTableThClass}>Paket durumu</th>
              <th className={uiTableThClass}>Ödeme zamanı / kaynak</th>
              <th className={`${uiTableThClass} text-right`}>Ödenen</th>
              <th className={`${uiTableThClass} text-right`}>Kalan</th>
              <th className={uiTableThClass}>Ödeme tarihi</th>
              <th className={uiTableThClass}>Açıklama</th>
              <th className={uiTableThClass}>Durum</th>
              {showOps ? <th className={uiTableThClass}>İşlem</th> : null}
            </tr>
          }
        >
          {visibleRows.map((row) => (
            <tr key={row.id} className={`${uiTableRowHoverClass} text-xs text-gray-200`}>
              <td className={uiTableTdClass}>{row.athleteName}</td>
              <td className={uiTableTdClass}>
                <span className="ui-badge-neutral inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold text-gray-300">
                  {getPaymentTuruBucket(row.paymentKind)}
                </span>
              </td>
              <td className={`${uiTableTdClass} text-[11px] text-gray-400`}>
                {row.packageId ? getPackageLifecycleLabel(row.packageLifecycleStatus) : "—"}
              </td>
              <td className={`${uiTableTdClass} max-w-[11rem] text-[11px] text-gray-300`}>{row.channelLabel}</td>
              <td className={`${uiTableTdClass} text-right font-bold tabular-nums text-emerald-200/95`}>
                {formatMoney(row.paidAmount)}
              </td>
              <td className={`${uiTableTdClass} text-right tabular-nums text-gray-300`}>{formatRemainingBalanceCell(row)}</td>
              <td className={uiTableTdClass}>
                {row.paymentDate ? new Date(row.paymentDate).toLocaleDateString("tr-TR") : "—"}
              </td>
              <td className={`${uiTableTdClass} max-w-[14rem] text-[11px] text-gray-400`}>{row.descriptionText}</td>
              <td className={uiTableTdClass}>
                <span
                  className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${getAccountingPaymentRowStatusBadgeClass(row)}`}
                >
                  {getAccountingPaymentRowStatusLabel(row)}
                </span>
              </td>
              {showOps ? (
                <td className={uiTableTdClass}>
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
              <td colSpan={showOps ? 10 : 9} className={`${uiTableTdClass} py-8`}>
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
        </DataTable>
      </div>

      {!isEmpty && rows.length > PAYMENTS_PAGE_SIZE ? (
        <DataTablePagination page={page} pageSize={PAYMENTS_PAGE_SIZE} total={rows.length} onChange={setPage} />
      ) : null}

      {dialog ? (
        <OverlayDialog
          open
          onClose={() => {
            if (!busy) closeAdjustDialog();
          }}
          layer={OVERLAY_Z.MODAL_ELEVATED}
          shellClassName="w-full max-w-md rounded-2xl border border-white/10  p-5 shadow-2xl !max-w-md"
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
                className="mt-1 ui-input w-full rounded-xl px-3 py-2 text-sm"
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
                  className="mt-1 ui-input w-full rounded-xl px-3 py-2 text-sm"
                />
              </label>
            ) : null}
            {localError ? <p className="mt-2 text-[11px] font-bold text-rose-300">{localError}</p> : null}
            <OverlayFooter>
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
            </OverlayFooter>
        </OverlayDialog>
      ) : null}
    </section>
  );
}
