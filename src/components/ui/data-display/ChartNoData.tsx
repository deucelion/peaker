"use client";

import { Activity } from "lucide-react";

/**
 * Wave 12 — token-bound chart empty state (decoupled from athlete detail primitives).
 */
export function ChartNoData({ label = "VERİ YOK" }: { label?: string }) {
  return (
    <div className="ui-chart-no-data group h-full min-h-[100px]">
      <Activity className="ui-chart-no-data__icon mb-3" size={32} aria-hidden />
      <p className="ui-chart-no-data__label">{label}</p>
    </div>
  );
}

export default ChartNoData;
