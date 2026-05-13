"use client";

import { memo, useMemo, type ReactNode } from "react";
import { ResponsiveContainer } from "recharts";
import { NoData } from "@/app/(dashboard)/sporcu/[id]/_components/AthleteDetailPrimitives";

/**
 * Faz 8.11 — Reusable chart frame.
 *
 * Hedef:
 *   - `ResponsiveContainer` her parent re-render'ında kendi reconciler'ını çevirir.
 *     Frame'i memo'lamak gereksiz re-render maliyetini düşürür.
 *   - Boş veri durumunu standardize eder (`NoData`).
 *   - Min-width / aspect ratio tutarlılığı sağlar.
 *
 * Davranış değişikliği yok:
 *   - Mevcut sayfalardaki `<ResponsiveContainer width="100%" height="100%">` ve
 *     yanındaki "veri yok" branch'leri bu component'e taşınabilir.
 *
 * Performans:
 *   - `React.memo` ile shallow-compare; chart children'ı genelde aynı reference
 *     ise re-render önlenir.
 *   - Tooltip style gibi inline obje'ler module-level sabitlerle değiştirilmeli;
 *     bunun için `chartTooltipStyle` export edildi.
 */

export const chartTooltipStyle = {
  contentStyle: {
    backgroundColor: "#1c1c21",
    border: "1px solid rgba(124,58,237,0.2)",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: "bold",
  },
  itemStyle: { color: "#7c3aed" },
} as const;

type ChartFrameProps = {
  /** Boş veri sinyali; true ise `NoData` gösterilir. */
  isEmpty?: boolean;
  /** Boş durum etiketi. */
  emptyLabel?: string;
  /** Yükseklik sınıfı (Tailwind). Mevcut sayfaların kullandığı pattern korunur. */
  heightClassName?: string;
  /** Çocuklar (recharts root chart bileşeni). */
  children: ReactNode;
};

function ChartFrameInner({
  isEmpty,
  emptyLabel = "VERİ YOK",
  heightClassName = "h-[220px] sm:h-[260px] md:h-[280px]",
  children,
}: ChartFrameProps) {
  const wrapperClass = useMemo(
    () => `${heightClassName} w-full min-w-0`,
    [heightClassName]
  );
  if (isEmpty) {
    return (
      <div className={wrapperClass}>
        <NoData label={emptyLabel} />
      </div>
    );
  }
  return (
    <div className={wrapperClass}>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

export const ChartFrame = memo(ChartFrameInner);
ChartFrame.displayName = "ChartFrame";
