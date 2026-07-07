type PartialDataNoticeProps = {
  missing: Array<"wellness" | "rpe" | "field-test">;
  className?: string;
};

const LABELS: Record<PartialDataNoticeProps["missing"][number], string> = {
  wellness: "Wellness verisi yok — son dönemde sabah raporu girilmemiş olabilir.",
  rpe: "İdman yükü (RPE) kaydı yok — grafikler kısmi görüntülenir.",
  "field-test": "Saha testi ölçümü yok — sinyal kartı boş kalabilir.",
};

export function PartialDataNotice({ missing, className = "" }: PartialDataNoticeProps) {
  if (missing.length === 0) return null;

  return (
    <div
      className={`rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 ${className}`}
      role="status"
      aria-label="Kısmi veri uyarısı"
    >
      <p className="text-[9px] font-black uppercase tracking-wider text-amber-200">Kısmi veri</p>
      <ul className="mt-1 space-y-0.5 text-[9px] font-bold leading-relaxed text-amber-100/90">
        {missing.map((key) => (
          <li key={key}>{LABELS[key]}</li>
        ))}
      </ul>
    </div>
  );
}
