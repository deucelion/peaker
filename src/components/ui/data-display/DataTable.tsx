"use client";

import type { ReactNode } from "react";

export type DataTableLayout = "table" | "records";

export type DataTableProps = {
  caption?: ReactNode;
  head?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  layout?: DataTableLayout;
  /** Skip outer shell border/background — scroll + table only */
  bare?: boolean;
  stickyHeader?: boolean;
  className?: string;
  scrollClassName?: string;
  tableClassName?: string;
  headClassName?: string;
  bodyClassName?: string;
};

/**
 * Faz 7.2 / Wave 11 — token-bound responsive data table primitive.
 */
export function DataTable({
  caption,
  head,
  children,
  footer,
  layout = "table",
  bare = false,
  stickyHeader = false,
  className = "",
  scrollClassName = "ui-table-scroll",
  tableClassName = "",
  headClassName = "ui-table-head ui-table-head--filled",
  bodyClassName = "ui-table-body",
}: DataTableProps) {
  const shellClass = bare ? `min-w-0 ${className}`.trim() : `ui-table-shell ${className}`.trim();

  return (
    <div className={shellClass}>
      {caption ? <div className="ui-table-caption">{caption}</div> : null}
      {layout === "table" ? (
        <div className={`w-full overflow-x-auto ${scrollClassName}`.trim()}>
          <table className={`ui-table min-w-full text-left text-[11px] ${tableClassName}`.trim()}>
            {head ? (
              <thead
                className={`${headClassName}${stickyHeader ? " ui-table-head--sticky" : ""}`.trim()}
              >
                {head}
              </thead>
            ) : null}
            <tbody className={bodyClassName}>{children}</tbody>
          </table>
        </div>
      ) : (
        <div className={`ui-table-records min-w-0 ${bodyClassName}`.trim()}>{children}</div>
      )}
      {footer ? <div className="ui-table-footer">{footer}</div> : null}
    </div>
  );
}

/** Shared row/cell class helpers for consumers. */
export const uiTableRowClass = "ui-table-row";
export const uiTableRowHoverClass = "ui-table-row ui-table-row--hover";
export const uiTableThClass = "ui-table-th";
export const uiTableTdClass = "ui-table-td";

export default DataTable;
