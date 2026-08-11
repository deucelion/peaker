"use client";

import { overlayBackdropStyle } from "@/lib/ui/branding/overlaySelectors";
import { OVERLAY_Z, type OverlayZLayer } from "./overlayZIndex";

export type OverlayBackdropProps = {
  onClose?: () => void;
  layer?: OverlayZLayer;
  strong?: boolean;
  className?: string;
  "aria-hidden"?: boolean;
};

export function OverlayBackdrop({
  onClose,
  layer: _layer = OVERLAY_Z.BACKDROP,
  strong = false,
  className = "",
  "aria-hidden": ariaHidden = true,
}: OverlayBackdropProps) {
  const classNames = `ui-overlay-backdrop ${className}`.trim();
  const style = overlayBackdropStyle(strong);

  if (onClose) {
    return (
      <button
        type="button"
        onClick={onClose}
        aria-label="Kapat"
        aria-hidden={ariaHidden}
        className={classNames}
        style={style}
      />
    );
  }

  return <div aria-hidden={ariaHidden} className={classNames} style={style} />;
}

export default OverlayBackdrop;
