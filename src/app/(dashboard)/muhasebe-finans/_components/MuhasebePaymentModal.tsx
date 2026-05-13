"use client";

import { CollectionPaymentForm } from "@/components/finance/CollectionPaymentForm";
import type { AccountingFinanceSnapshot } from "@/lib/actions/accountingFinanceActions";

export type MuhasebePaymentModalProps = {
  open: boolean;
  resetKey: number;
  busy: boolean;
  organizationIdFromUrl: string | null;
  athletes: AccountingFinanceSnapshot["options"]["athletes"];
  onBusyChange: (busy: boolean) => void;
  onError: (message: string) => void;
  onCancel: () => void;
  onSuccess: () => Promise<void> | void;
  onClose: () => void;
};

export function MuhasebePaymentModal({
  open,
  resetKey,
  busy,
  organizationIdFromUrl,
  athletes,
  onBusyChange,
  onError,
  onCancel,
  onSuccess,
  onClose,
}: MuhasebePaymentModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-6">
      <div
        className="max-h-[min(90dvh,800px)] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#101013] shadow-2xl shadow-black/40"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
      >
        <div className="border-b border-white/10 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="payment-modal-title" className="text-base font-black uppercase tracking-wide text-white">
                Tahsilat ekle
              </h3>
              <p className="mt-0.5 text-[11px] font-semibold text-gray-500">Kayıt tahsilat tablosuna düşer.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Kapat
            </button>
          </div>
        </div>
        <div className="p-5 sm:p-6">
          <CollectionPaymentForm
            organizationIdFromUrl={organizationIdFromUrl}
            athletes={athletes}
            resetKey={resetKey}
            initialPrefill={{}}
            layout="modal"
            onBusyChange={onBusyChange}
            onError={onError}
            onCancel={onCancel}
            onSuccess={onSuccess}
          />
        </div>
      </div>
    </div>
  );
}
