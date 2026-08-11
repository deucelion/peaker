"use client";

import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";
import { CollectionPaymentForm } from "@/components/finance/CollectionPaymentForm";
import { FinanceScopeChip } from "@/components/finance/FinanceScopeChip";
import { OverlaySheet, OVERLAY_Z } from "@/components/ui/overlay";

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
  const handleClose = () => {
    if (!busy) onClose();
  };

  return (
    <OverlaySheet
      open={open}
      onClose={handleClose}
      layer={OVERLAY_Z.DIALOG}
      titleId="tahsilat-sheet-title"
      className="sm:!items-stretch sm:!justify-end sm:!p-0"
      shellClassName="max-h-[min(92dvh,820px)] overflow-y-auto rounded-t-2xl shadow-2xl shadow-black/50 sm:max-h-none sm:h-full sm:w-full sm:max-w-lg sm:rounded-none sm:rounded-l-2xl !p-0"
    >
      <div className="sticky top-0 z-10 border-b border-white/10 /95 p-4 backdrop-blur-sm">
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
    </OverlaySheet>
  );
}
