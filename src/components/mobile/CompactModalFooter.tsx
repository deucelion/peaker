"use client";

import type { ReactNode } from "react";
import { OverlayFooter } from "@/components/ui/overlay/OverlayFooter";

/**
 * Mobil modal alt çubuğu — Wave 7 shared overlay footer primitive.
 * Domain modals keep importing this path until Wave 8 migration.
 */
export function CompactModalFooter({ children }: { children: ReactNode }) {
  return <OverlayFooter>{children}</OverlayFooter>;
}

export { OverlayFooter };
