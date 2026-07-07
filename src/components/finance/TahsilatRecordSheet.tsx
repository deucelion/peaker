"use client";

import { CollectionPaymentForm } from "@/components/finance/CollectionPaymentForm";
import { FinanceScopeChip } from "@/components/finance/FinanceScopeChip";

export type TahsilatRecordSheetProps = {
  open: boolean;
  organizationIdFromUrl: string | null;
  athletes: { id: string; full_name: string }[];
  resetKey: number;
  initialPrefill?: {
    profileId?: string;
    packageId?: string;
    paymentKind?: string;
  };
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onClose: () => void;
  onError: (message: string) => void;
  onSuccess: () => Promise<void> | void;
};

export function TahsilatRecordSheet({
  open,
  organizationIdFromUrl,
  athletes,
  resetKey,
  initialPrefill,
  busy,
  onBusyChange,
  onClose,
  onError,
  onSuccess,
}: TahsilatRecordSheetProps) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Tahsilat formunu kapat"
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <aside
        className="fixed inset-x-0 bottom-0 z-50 max-h-[min(92dvh,820px)] overflow-y-auto rounded-t-2xl border border-white/10 bg-[#101013] shadow-2xl shadow-black/50 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-full sm:max-w-lg sm:rounded-none sm:rounded-l-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tahsilat-sheet-title"
      >
        <div className="sticky top-0 z-10 border-b border-white/10 bg-[#101013]/95 p-4 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h2 id="tahsilat-sheet-title" className="text-base font-black uppercase tracking-wide text-white">
                  Tahsilat kaydet
                </h2>
                <FinanceScopeChip scope="new_record" />
              </div>
              <p className="text-[11px] font-semibold text-gray-500">
                Kayıt <strong className="font-black text-emerald-300">ödendi</strong> olarak deftere işlenir.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-white/5 disabled:opacity-40"
            >
              Kapat
            </button>
          </div>
        </div>
        <div className="p-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
          <CollectionPaymentForm
            organizationIdFromUrl={organizationIdFromUrl}
            athletes={athletes}
            resetKey={resetKey}
            initialPrefill={initialPrefill}
            layout="modal"
            onBusyChange={onBusyChange}
            onError={onError}
            onCancel={onClose}
            onSuccess={onSuccess}
          />
        </div>
      </aside>
    </>
  );
}
