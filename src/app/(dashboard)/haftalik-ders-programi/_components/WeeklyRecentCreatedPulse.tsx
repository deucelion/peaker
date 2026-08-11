"use client";

import { memo } from "react";
import { DAY_MINUTES, GRID_START_HOUR } from "../_utils/scheduleGrid";

/**
 * Faz 12.5 — Decoupled "yeni oluşturuldu" pulse.
 *
 * Önce: pulse görünürlüğü `recentCreatedRange.expiresAt > now.getTime()` ile
 * grid'in tick-state'ine bağlıydı; pulse'un gizlenmesi grid rerender'a
 * tetikleniyordu.
 *
 * Şimdi: parent (page.tsx) zaten expiresAt sonrası `setRecentCreatedRange(null)`
 * yapan bir timer çalıştırıyor (`useEffect` ile). Dolayısıyla burada lokal
 * timer/state tutmaya gerek yok; component sadece `range` non-null + dayKey
 * eşleşmesi varsa render eder.
 *
 * Memo'lu olduğu için aynı range/dayKey ile rerender atlanır; range null
 * olduğunda zaten unmount edilir.
 */

export type WeeklyRecentCreatedPulseProps = {
  range: {
    dayKey: string;
    startMinutes: number;
    endMinutes: number;
    expiresAt: number;
  } | null;
  targetDayKey: string;
};

function WeeklyRecentCreatedPulseImpl({ range, targetDayKey }: WeeklyRecentCreatedPulseProps) {
  if (!range) return null;
  if (range.dayKey !== targetDayKey) return null;

  const pulseTop = ((range.startMinutes - GRID_START_HOUR * 60) / DAY_MINUTES) * 100;
  const pulseHeight = Math.max(
    ((range.endMinutes - range.startMinutes) / DAY_MINUTES) * 100,
    3.2
  );

  return (
    <div
      className="pointer-events-none absolute left-1.5 right-1.5 z-10 rounded-2xl border border-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_45%,transparent)] ui-kpi-chip--brand animate-pulse"
      style={{ top: `${pulseTop}%`, height: `${pulseHeight}%` }}
    />
  );
}

export const WeeklyRecentCreatedPulse = memo(WeeklyRecentCreatedPulseImpl);
export default WeeklyRecentCreatedPulse;
