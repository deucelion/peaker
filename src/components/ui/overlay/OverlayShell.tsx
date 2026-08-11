"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { overlayPanelStyle } from "@/lib/ui/branding/overlaySelectors";

export type OverlayShellVariant = "dialog" | "drawer" | "sheet" | "menu";

export type OverlayShellProps = {
  children: ReactNode;
  variant?: OverlayShellVariant;
  className?: string;
} & Pick<HTMLAttributes<HTMLDivElement>, "id" | "aria-labelledby" | "aria-describedby">;

const VARIANT_CLASS: Record<OverlayShellVariant, string> = {
  dialog: "ui-overlay-shell ui-dialog",
  drawer: "ui-overlay-shell ui-drawer",
  sheet: "ui-overlay-shell ui-overlay-sheet",
  menu: "ui-overlay-shell ui-overlay-menu",
};

/**
 * Shared overlay panel chrome — branding-bound surface only.
 */
export function OverlayShell({
  children,
  variant = "dialog",
  className = "",
  id,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
}: OverlayShellProps) {
  return (
    <div
      id={id}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      className={`${VARIANT_CLASS[variant]} ${className}`.trim()}
      style={overlayPanelStyle()}
      data-overlay-variant={variant}
    >
      {children}
    </div>
  );
}

export default OverlayShell;
