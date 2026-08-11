"use client";

import { useEffect, useRef, type HTMLAttributes, type ReactNode } from "react";
import { activateOverlayFocusTrap } from "./overlayFocusTrap";
import { OVERLAY_Z, overlayZIndex, type OverlayZLayer } from "./overlayZIndex";

export type OverlayContainerProps = {
  children: ReactNode;
  layer?: OverlayZLayer;
  className?: string;
  enableFocusTrap?: boolean;
  onEscape?: () => void;
} & Pick<HTMLAttributes<HTMLDivElement>, "role" | "aria-modal" | "aria-labelledby" | "aria-label">;

/**
 * Fixed viewport overlay root. Applies registry z-index and optional focus trap.
 */
export function OverlayContainer({
  children,
  layer = OVERLAY_Z.DIALOG,
  className = "",
  enableFocusTrap = false,
  onEscape,
  role,
  "aria-modal": ariaModal,
  "aria-labelledby": ariaLabelledBy,
  "aria-label": ariaLabel,
}: OverlayContainerProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enableFocusTrap || !rootRef.current) {
      return undefined;
    }
    return activateOverlayFocusTrap({
      container: rootRef.current,
      onEscape,
    });
  }, [enableFocusTrap, onEscape]);

  return (
    <div
      ref={rootRef}
      role={role}
      aria-modal={ariaModal}
      aria-labelledby={ariaLabelledBy}
      aria-label={ariaLabel}
      className={`ui-overlay-container ${className}`.trim()}
      style={{ zIndex: overlayZIndex(layer) }}
    >
      {children}
    </div>
  );
}

export default OverlayContainer;
