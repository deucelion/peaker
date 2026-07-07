type PerformanceExportHintProps = {
  scope: "performans" | "athlete-insights" | "field-test" | "session-csv";
  className?: string;
};

const HINTS: Record<PerformanceExportHintProps["scope"], { title: string; detail: string; other?: string }> = {
  performans: {
    title: "Bu export · seçili sporcu · son 30 gün · ACWR + EWMA",
    detail: "Organizasyon CSV tüm sporcuların özet satırlarını içerir.",
    other: "Saha test PDF’leri sporcu profilinde › Alan Testleri bölümünden alınabilir.",
  },
  "athlete-insights": {
    title: "Bu export · sporcu analiz PDF · seçili tarih aralığı",
    detail: "ACWR, EWMA ve yük tablolarını içerir.",
    other: "Tek tarih veya karşılaştırma PDF’i › Alan Testleri bölümünden.",
  },
  "field-test": {
    title: "Bu export · saha test sonuçları · seçili tarih",
    detail: "Metrik değerleri ve birimler PDF’e yazılır.",
    other: "Yük analizi PDF’i Performans Merkezi › Analiz PDF.",
  },
  "session-csv": {
    title: "Bu export · oturum CSV · tüm sporcular · bu tarih",
    detail: "Excel veya Google Sheets ile açılabilir.",
    other: "Takım bar grafiği › Saha Testleri › Takım raporu.",
  },
};

export function PerformanceExportHint({ scope, className = "" }: PerformanceExportHintProps) {
  const hint = HINTS[scope];
  return (
    <p className={`text-[8px] font-bold uppercase leading-relaxed tracking-wide text-gray-500 ${className}`}>
      <span className="text-gray-400">{hint.title}</span>
      <span className="mx-1 opacity-40">·</span>
      {hint.detail}
      {hint.other ? (
        <>
          <span className="mx-1 opacity-40">·</span>
          <span className="text-gray-600">{hint.other}</span>
        </>
      ) : null}
    </p>
  );
}
