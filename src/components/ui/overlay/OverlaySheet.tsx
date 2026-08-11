"use client";

import type { ReactNode } from "react";
import { OverlayBackdrop } from "./OverlayBackdrop";
import { OverlayContainer } from "./OverlayContainer";
import { OverlayShell } from "./OverlayShell";
import { OVERLAY_Z, type OverlayZLayer } from "./overlayZIndex";

export type OverlaySheetProps = {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  titleId?: string;
  layer?: OverlayZLayer;
  className?: string;
  shellClassName?: string;
  enableFocusTrap?: boolean;
};

/** Bottom sheet / responsive sheet primitive — adoption deferred to Wave 9. */
export function OverlaySheet({
  open,
  onClose,
  children,
  titleId,
  layer = OVERLAY_Z.DIALOG,
  className = "",
  shellClassName = "",
  enableFocusTrap = true,
}: OverlaySheetProps) {
  if (!open) {
    return null;
  }

  return (
    <OverlayContainer
      layer={layer}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      enableFocusTrap={enableFocusTrap}
      onEscape={onClose}
      className={`ui-overlay-stage ui-overlay-stage--sheet ${className}`.trim()}
    >
      <OverlayBackdrop onClose={onClose} layer={layer} />
      <OverlayShell variant="sheet" className={shellClassName} aria-labelledby={titleId}>
        {children}
      </OverlayShell>
    </OverlayContainer>
  );
}

export default OverlaySheet;
