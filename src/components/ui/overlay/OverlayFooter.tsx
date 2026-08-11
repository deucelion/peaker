"use client";

import type { ReactNode } from "react";

/**
 * Shared overlay footer slot — sticky mobile actions with safe-area padding.
 * CompactModalFooter re-exports this primitive for backward compatibility.
 */
export function OverlayFooter({ children }: { children: ReactNode }) {
  return (
    <div className="ui-overlay-footer">
      <div className="ui-overlay-footer__actions">{children}</div>
    </div>
  );
}

export default OverlayFooter;
