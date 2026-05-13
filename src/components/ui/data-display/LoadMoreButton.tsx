"use client";

import { Loader2 } from "lucide-react";

/**
 * Faz 8.8 — Standart "Daha fazla yükle" butonu.
 *
 * Hedef:
 *   - Wellness, notifications, athlete timeline gibi load-more pattern'i
 *     kullanan listeler için tutarlı UI.
 *   - Mobil touch hedefi: `min-h-11`.
 *   - Davranış parity: butonu içeren sayfa state'i (page/total/loading) korur.
 */
export function LoadMoreButton({
  loaded,
  total,
  loading,
  onClick,
  label = "Daha fazla yükle",
  loadingLabel = "Yükleniyor...",
  className,
}: {
  loaded: number;
  total: number;
  loading: boolean;
  onClick: () => void;
  label?: string;
  loadingLabel?: string;
  className?: string;
}) {
  if (loaded >= total || total === 0) return null;
  return (
    <div className={`flex justify-center pt-2 ${className ?? ""}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-[#121215] px-6 py-2 text-[10px] font-black uppercase tracking-widest text-white/80 sm:hover:border-[#7c3aed]/30 sm:hover:bg-[#7c3aed]/10 transition-colors disabled:opacity-50 touch-manipulation"
      >
        {loading ? (
          <>
            <Loader2 size={14} className="animate-spin text-[#7c3aed]" aria-hidden />
            {loadingLabel}
          </>
        ) : (
          <>
            {label} ({loaded}/{total})
          </>
        )}
      </button>
    </div>
  );
}

export default LoadMoreButton;
