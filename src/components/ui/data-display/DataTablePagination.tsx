"use client";

/**
 * Faz 7.2 / Wave 11 — token-bound pagination control.
 */
export function DataTablePagination({
  page,
  pageSize,
  total,
  onChange,
  className = "",
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
    <div className={`ui-table-pagination ${className}`.trim()}>
      <p className="ui-table-pagination__summary">
        {total === 0 ? "0 kayıt" : `${fromIndex}-${toIndex} / ${total}`}
      </p>
      <div className="ui-table-pagination__controls">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onChange(safePage - 1)}
          className="ui-table-pagination__button"
        >
          Önceki
        </button>
        <span className="ui-table-pagination__page">
          {safePage}/{totalPages}
        </span>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onChange(safePage + 1)}
          className="ui-table-pagination__button"
        >
          Sonraki
        </button>
      </div>
    </div>
  );
}

export default DataTablePagination;
