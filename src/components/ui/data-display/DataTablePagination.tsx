"use client";

/**
 * Faz 7.2 — Standart sayfalama kontrolü.
 *
 * - Sunucu-side pagination kullanan listeler için tasarlandı (audit-log,
 *   bildirimler, payments).
 * - Mobil dokunma hedeflerini korumak için `min-h-11` standardına uyar.
 */
export function DataTablePagination({
  page,
  pageSize,
  total,
  onChange,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (nextPage: number) => void;
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const fromIndex = (safePage - 1) * pageSize + 1;
  const toIndex = Math.min(safePage * pageSize, total);

  return (
    <div
      className={`flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:justify-between ${className ?? ""}`}
    >
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
        {total === 0 ? "0 kayıt" : `${fromIndex}-${toIndex} / ${total}`}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onChange(safePage - 1)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[10px] font-black uppercase tracking-widest text-gray-200 hover:border-[#7c3aed]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-9"
        >
          Önceki
        </button>
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          {safePage}/{totalPages}
        </span>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onChange(safePage + 1)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-[10px] font-black uppercase tracking-widest text-gray-200 hover:border-[#7c3aed]/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-9"
        >
          Sonraki
        </button>
      </div>
    </div>
  );
}

export default DataTablePagination;
