"use client";

import type { ReactNode } from "react";

/**
 * Mobil modal alt çubuğu: sticky, safe-area, yatay kaydırma ile sıkışmayı önler.
 */
export function CompactModalFooter({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-6 mt-4 border-t border-white/10 bg-[#17171d]/95 px-4 py-3 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
      <div className="flex max-w-full flex-wrap justify-end gap-2 overflow-x-auto">{children}</div>
    </div>
  );
}
