"use client";

import type { ReactNode } from "react";
import { OverlayBackdrop } from "./OverlayBackdrop";
import { OverlayContainer } from "./OverlayContainer";
import { OverlayShell } from "./OverlayShell";
import { OVERLAY_Z, type OverlayZLayer } from "./overlayZIndex";

export type OverlayDrawerProps = {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  titleId?: string;
  layer?: OverlayZLayer;
  className?: string;
  shellClassName?: string;
  enableFocusTrap?: boolean;
};

/** Right-side drawer primitive — adoption deferred to Wave 9. */
export function OverlayDrawer({
  open,
  onClose,
  children,
  titleId,
  layer = OVERLAY_Z.DIALOG,
  className = "",
  shellClassName = "",
  enableFocusTrap = true,
}: OverlayDrawerProps) {
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
      className={`ui-overlay-stage ui-overlay-stage--drawer ${className}`.trim()}
    >
      <OverlayBackdrop onClose={onClose} layer={layer} />
      <OverlayShell variant="drawer" className={shellClassName} aria-labelledby={titleId}>
        {children}
      </OverlayShell>
    </OverlayContainer>
  );
}

export default OverlayDrawer;
