"use client";

import { memo, useEffect, useState } from "react";
import { nowLineTopPercent } from "../_utils/scheduleGrid";

/**
 * Faz 12.5 — Decoupled "Şu an" çizgisi.
 *
 * Önce: `now` state `WeeklyScheduleGrid` parent'ına ait, her dakika tick'inde
 * tüm grid (lesson card'lar dahil) rerender oluyordu.
 *
 * Şimdi: clock tick'i bu izole leaf component içinde. Parent rerender olmaz,
 * sadece `nowTop` state değişiminde DOM `top` percentage güncellenir.
 *
 * `weekContainsToday` parent'tan geliyor (hafta bilgisine bağlı). Eğer
 * bugün dışındaysa render edilmez.
 */

export type WeeklyNowLineProps = {
  appTz: string;
  weekContainsToday: boolean;
  pollMs?: number;
};

function WeeklyNowLineImpl({ appTz, weekContainsToday, pollMs = 30_000 }: WeeklyNowLineProps) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    if (!weekContainsToday) return;
    const id = window.setInterval(() => setNow(new Date()), pollMs);
    return () => window.clearInterval(id);
  }, [weekContainsToday, pollMs]);

  if (!weekContainsToday) return null;
  const nowTop = nowLineTopPercent(now, appTz);
  if (nowTop == null) return null;

  return (
    <div
      className="pointer-events-none absolute left-[88px] right-0 z-20 border-t border-rose-300/80"
      style={{ top: `${nowTop}%` }}
    >
      <span className="absolute -left-12 -top-2 rounded bg-rose-500/90 px-1 py-0.5 text-[9px] font-black uppercase tracking-wide text-white">
        Şu an
      </span>
    </div>
  );
}

export const WeeklyNowLine = memo(WeeklyNowLineImpl);
export default WeeklyNowLine;
