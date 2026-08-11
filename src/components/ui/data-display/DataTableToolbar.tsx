"use client";

import type { ReactNode } from "react";

/**
 * Faz 7.2 / Wave 11 — token-bound table toolbar.
 */
export function DataTableToolbar({
  children,
  actions,
  className = "",
}: {
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`ui-table-toolbar ${className}`.trim()}>
      <div className="ui-table-toolbar__main">{children}</div>
      {actions ? <div className="ui-table-toolbar__actions">{actions}</div> : null}
    </div>
  );
}

export default DataTableToolbar;
