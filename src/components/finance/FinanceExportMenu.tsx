"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import { OverlayMenu, OVERLAY_Z, overlayZIndex } from "@/components/ui/overlay";

export type FinanceExportMenuItem = {
  id: string;
  label: string;
  description?: string;
  onSelect: () => void;
  disabled?: boolean;
};

type Props = {
  items: FinanceExportMenuItem[];
  exporting?: boolean;
  label?: string;
  className?: string;
};

export function FinanceExportMenu({ items, exporting = false, label = "Dışa aktar", className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = "finance-export-menu";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const enabledItems = items.filter((i) => !i.disabled);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={exporting || enabledItems.length === 0}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 text-[10px] font-black uppercase tracking-wide text-gray-300 hover:bg-white/5 disabled:opacity-50 sm:min-h-9"
      >
        {exporting ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-emerald-400" aria-hidden />
        ) : (
          <Download size={12} className="shrink-0 opacity-80" aria-hidden />
        )}
        {label}
        <ChevronDown size={12} className={`opacity-70 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open ? (
        <div
          className="absolute right-0 mt-2 min-w-[14rem]"
          style={{ zIndex: overlayZIndex(OVERLAY_Z.BACKDROP) }}
        >
          <OverlayMenu labelledBy={menuId} className="py-1 shadow-2xl shadow-black/50">
          <p id={menuId} className="sr-only">
            Dışa aktarma seçenekleri
          </p>
          {enabledItems.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => {
                item.onSelect();
                setOpen(false);
              }}
              className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left hover:bg-white/5"
            >
              <span className="text-[11px] font-black uppercase text-white">{item.label}</span>
              {item.description ? (
                <span className="text-[10px] font-semibold text-gray-500">{item.description}</span>
              ) : null}
            </button>
          ))}
          </OverlayMenu>
        </div>
      ) : null}
    </div>
  );
}
