"use client";

import type { ReactNode } from "react";
import { OverlayBackdrop } from "./OverlayBackdrop";
import { OverlayContainer } from "./OverlayContainer";
import { OverlayShell } from "./OverlayShell";
import { OVERLAY_Z, type OverlayZLayer } from "./overlayZIndex";

export type OverlayDialogProps = {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  titleId?: string;
  descriptionId?: string;
  layer?: OverlayZLayer;
  strongBackdrop?: boolean;
  className?: string;
  shellClassName?: string;
  enableFocusTrap?: boolean;
};

/** Centered dialog primitive — not adopted by domain modals until Wave 8. */
export function OverlayDialog({
  open,
  onClose,
  children,
  titleId,
  descriptionId,
  layer = OVERLAY_Z.DIALOG,
  strongBackdrop = false,
  className = "",
  shellClassName = "",
  enableFocusTrap = true,
}: OverlayDialogProps) {
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
      className={`ui-overlay-stage ui-overlay-stage--center ${className}`.trim()}
    >
      <OverlayBackdrop onClose={onClose} layer={layer} strong={strongBackdrop} />
      <OverlayShell
        variant="dialog"
        className={shellClassName}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        {children}
      </OverlayShell>
    </OverlayContainer>
  );
}

export default OverlayDialog;
