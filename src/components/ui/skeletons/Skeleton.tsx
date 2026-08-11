"use client";

/**
 * Standart skeleton bileşenleri (Faz 4.4 / 4.x).
 *
 * Hedef:
 *   - Sayfa yüklenirken Loader2 spinner yerine layout uyumlu placeholder göster.
 *   - Ani layout jump'ı engelle.
 *   - Mobile + desktop'ta sabit yükseklik koru (özellikle chart için).
 *   - Tasarım dili: token-bound ui-skeleton-* / ui-kpi-card shells (Wave 13).
 *
 * Kullanım:
 *   <SkeletonStat />              // KPI kartı
 *   <SkeletonStatGrid count={4}/> // KPI grid
 *   <SkeletonCard rows={3} />     // Genel kart
 *   <SkeletonTable rows={5} cols={6} /> // Tablo
 *   <SkeletonChart height={280} variant="bar"|"line"|"radar" />
 */

export function SkeletonLine({
  width = "100%",
  height = "0.75rem",
  className = "",
}: {
  width?: string | number;
  height?: string | number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`ui-skeleton-line ${className}`}
      style={{ width, height }}
    />
  );
}

export function SkeletonStat() {
  return (
    <article className="ui-skeleton-stat" aria-hidden>
      <SkeletonLine width="35%" height="0.55rem" />
      <div className="mt-1.5">
        <SkeletonLine width="55%" height="1.1rem" />
      </div>
      <div className="mt-2">
        <SkeletonLine width="70%" height="0.55rem" />
      </div>
    </article>
  );
}

export function SkeletonStatGrid({
  count = 4,
  className = "",
}: {
  count?: number;
  className?: string;
}) {
  const cols = count >= 5 ? "ui-kpi-grid--5" : "";
  return (
    <div
      className={`ui-kpi-grid ${cols} ${className}`}
      role="status"
      aria-label="Yükleniyor"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <SkeletonStat key={idx} />
      ))}
    </div>
  );
}

export function SkeletonCard({
  rows = 3,
  className = "",
  withTitle = true,
}: {
  rows?: number;
  className?: string;
  withTitle?: boolean;
}) {
  return (
    <section
      className={`ui-skeleton-shell p-4 ${className}`}
      role="status"
      aria-label="Yükleniyor"
    >
      {withTitle ? (
        <div className="mb-3">
          <SkeletonLine width="40%" height="0.7rem" />
        </div>
      ) : null}
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, idx) => (
          <SkeletonLine key={idx} width={idx === rows - 1 ? "60%" : "100%"} height="0.7rem" />
        ))}
      </div>
    </section>
  );
}

export function SkeletonTable({
  rows = 5,
  cols = 6,
  className = "",
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div
      className={`ui-skeleton-shell overflow-hidden ${className}`}
      role="status"
      aria-label="Tablo yükleniyor"
    >
      <div className="border-b border-white/10 px-3 py-2">
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: cols }).map((_, idx) => (
            <SkeletonLine key={idx} width={`${Math.max(8, 18 - idx)}%`} height="0.55rem" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-white/5">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="flex flex-wrap items-center gap-3 px-3 py-3">
            {Array.from({ length: cols }).map((_, colIdx) => {
              const widthPct = colIdx === 0 ? 24 : colIdx === cols - 1 ? 14 : 10 + ((colIdx + rowIdx) % 4) * 2;
              return <SkeletonLine key={colIdx} width={`${widthPct}%`} height="0.7rem" />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonChart({
  height = 280,
  variant = "line",
  className = "",
  withLegend = true,
}: {
  height?: number;
  variant?: "line" | "bar" | "radar";
  className?: string;
  withLegend?: boolean;
}) {
  return (
    <section
      className={`ui-skeleton-shell p-4 ${className}`}
      role="status"
      aria-label="Grafik yükleniyor"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <SkeletonLine width="35%" height="0.7rem" />
        {withLegend ? <SkeletonLine width="20%" height="0.55rem" /> : null}
      </div>
      <div
        className="ui-skeleton-pulse relative w-full overflow-hidden rounded-xl border border-white/5"
        style={{ height }}
        aria-hidden
      >
        {variant === "line" ? (
          <svg className="absolute inset-0 h-full w-full opacity-60" viewBox="0 0 100 40" preserveAspectRatio="none">
            <path
              d="M0 30 L10 22 L20 25 L30 18 L40 20 L50 12 L60 15 L70 8 L80 13 L90 6 L100 10"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
              className="text-white/10"
            />
          </svg>
        ) : null}
        {variant === "bar" ? (
          <div className="absolute inset-x-3 bottom-3 top-6 flex items-end gap-1.5">
            {Array.from({ length: 14 }).map((_, idx) => (
              <span
                key={idx}
                className="flex-1 rounded-t bg-white/10"
                style={{ height: `${20 + ((idx * 13) % 70)}%` }}
              />
            ))}
          </div>
        ) : null}
        {variant === "radar" ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-1/2 rounded-full border border-white/10" />
            <div className="absolute size-1/3 rounded-full border border-white/10" />
            <div className="absolute size-1/5 rounded-full border border-white/10" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Sayfa düzeyi loading: tipik dashboard üst başlık + filter chip + KPI grid + tablo akışı.
 * Sayfaya özel skeleton'lar ihtiyaca göre kombine edilir; bu hazır kombinasyon
 * generic "iç içe yüklenirken" durumlarında kullanılabilir.
 */
export function SkeletonDashboardShell({
  statCount = 4,
  showChart = true,
  showTable = true,
}: {
  statCount?: number;
  showChart?: boolean;
  showTable?: boolean;
}) {
  return (
    <div className="space-y-5" role="status" aria-label="Sayfa yükleniyor">
      <SkeletonCard rows={2} />
      <SkeletonStatGrid count={statCount} />
      {showChart ? <SkeletonChart variant="line" height={260} /> : null}
      {showTable ? <SkeletonTable rows={5} cols={6} /> : null}
    </div>
  );
}
