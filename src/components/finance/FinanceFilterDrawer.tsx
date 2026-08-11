"use client";

import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";
import { SlidersHorizontal, X } from "lucide-react";
import { OverlayDrawer, OverlayFooter, OVERLAY_Z } from "@/components/ui/overlay";

type Chip = { key: string; label: string; onRemove?: () => void };

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  onApply: () => void;
  onReset: () => void;
  applyLabel?: string;
  resetLabel?: string;
  feedback?: string | null;
};

export function FinanceFilterDrawer({
  open,
  onClose,
  title = "Gelişmiş filtreler",
  children,
  onApply,
  onReset,
  applyLabel = "Uygula",
  resetLabel = "Sıfırla",
  feedback,
}: Props) {
  return (
    <OverlayDrawer
      open={open}
      onClose={onClose}
      layer={OVERLAY_Z.DIALOG}
      titleId="finance-filter-drawer-title"
      shellClassName="flex w-full max-w-md flex-col shadow-2xl !max-w-md !rounded-none !p-0 !h-full"
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
        <div>
          <h2 id="finance-filter-drawer-title" className="text-sm font-black uppercase text-white">
            {title}
          </h2>
          {feedback ? (
            <p className="mt-1 text-[10px] font-semibold text-emerald-400" role="status">
              {feedback}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/10 p-2 text-gray-400 hover:bg-white/5 hover:text-white"
          aria-label="Kapat"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
      <OverlayFooter>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/15 px-4 text-xs font-black uppercase text-gray-300 hover:bg-white/5"
        >
          {resetLabel}
        </button>
        <button
          type="button"
          onClick={() => {
            onApply();
            onClose();
          }}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-500 px-5 text-xs font-black uppercase text-black hover:bg-emerald-400"
        >
          {applyLabel}
        </button>
      </OverlayFooter>
    </OverlayDrawer>
  );
}

export function FinanceFilterChipRow({ chips }: { chips: Chip[] }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className={`${uiBrandingClasses.kpi.chip} inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold text-gray-200`}
        >
          {chip.label}
          {chip.onRemove ? (
            <button
              type="button"
              onClick={chip.onRemove}
              className="rounded-full p-0.5 text-gray-500 hover:bg-white/10 hover:text-white"
              aria-label={`${chip.label} filtresini kaldır`}
            >
              <X size={12} />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

export function FinanceFilterToggleButton({
  activeCount,
  onClick,
}: {
  activeCount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${uiBrandingClasses.button.ghost} inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-black uppercase text-gray-300 hover:text-white`}
    >
      <SlidersHorizontal size={14} aria-hidden />
      Filtrele{activeCount > 0 ? ` (${activeCount})` : ""}
    </button>
  );
}
