"use client";

import { useEffect, useState } from "react";
import { getPrivateLessonParallelPlanningMetrics } from "@/lib/actions/privateLessonSessionActions";
import type { PrivateLessonParallelPlanningMetrics } from "@/lib/privateLessons/privateLessonSlotOverlap";

export function PrivateLessonParallelMetricsStrip() {
  const [metrics, setMetrics] = useState<PrivateLessonParallelPlanningMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await getPrivateLessonParallelPlanningMetrics();
      if (cancelled) return;
      if ("error" in res) {
        setError(res.error ?? "Metrikler alınamadı.");
        setMetrics(null);
        return;
      }
      setError(null);
      setMetrics(res.metrics);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error || !metrics) return null;
  if (metrics.totalPrivateLessons === 0) return null;

  return (
    <div className="rounded-2xl bg-gradient-to-r ui-kpi-section px-4 py-3 text-[11px] font-bold text-gray-300">
      <p className="text-[9px] font-black uppercase tracking-wider ui-kpi-card__trend">
        Özel ders operasyon özeti · {metrics.monthLabel}
      </p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <span>
          Toplam özel ders: <span className="text-white">{metrics.totalPrivateLessons}</span>
        </span>
        <span>
          Paralel slotta planlanan:{" "}
          <span className="text-amber-200">{metrics.parallelPlannedSessions}</span>
        </span>
        {metrics.busiestHourLabel ? (
          <span>
            En yoğun saat: <span className="text-white">{metrics.busiestHourLabel}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default PrivateLessonParallelMetricsStrip;
