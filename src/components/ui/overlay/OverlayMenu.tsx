"use client";

import type { ReactNode } from "react";
import { OverlayShell } from "./OverlayShell";

export type OverlayMenuProps = {
  children: ReactNode;
  className?: string;
  labelledBy?: string;
};

/** Floating menu/listbox shell — no portal or positioning logic in Wave 7. */
export function OverlayMenu({ children, className = "", labelledBy }: OverlayMenuProps) {
  return (
    <OverlayShell variant="menu" className={className} aria-labelledby={labelledBy}>
      {children}
    </OverlayShell>
  );
}

export default OverlayMenu;
