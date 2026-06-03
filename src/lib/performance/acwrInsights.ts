export type AcwrRiskLevel = "low" | "optimal" | "caution" | "high" | "nodata";

export type AcwrInsight = {
  riskLevel: AcwrRiskLevel;
  summary: string;
  recommendation: string;
  coachNote: string;
};

/**
 * Spor bilimleri ACWR bantları (loadSeries / dashboard ile uyumlu):
 *   < 0.8       düşük yüklenme
 *   0.8 – 1.3   optimal (sweet spot)
 *   1.3 – 1.5   dikkat
 *   > 1.5       yüksek sakatlık riski
 */
export function analyzeAcwr(input: {
  acuteLoad: number;
  chronicLoad: number;
  acwr: number;
}): AcwrInsight {
  const acwr = Number(input.acwr);
  if (!Number.isFinite(acwr) || acwr <= 0) {
    return {
      riskLevel: "nodata",
      summary: "Yeterli yük verisi yok",
      recommendation: "RPE ve antrenman yükü kaydı ile ACWR hesaplanır.",
      coachNote: "En az 7–14 günlük tutarlı yük girişi önerilir.",
    };
  }

  if (acwr > 1.5) {
    return {
      riskLevel: "high",
      summary: "Yüksek sakatlık riski",
      recommendation: "Yük azaltımı değerlendirilmeli.",
      coachNote: "Akut yük kroniğe göre çok yüksek. Recovery ve hacim düşüşü planlayın.",
    };
  }

  if (acwr > 1.3 && acwr <= 1.5) {
    return {
      riskLevel: "caution",
      summary: "Dikkat bölgesi",
      recommendation: "Recovery yakından takip edilmeli.",
      coachNote: "Yük artışı gözlemleniyor. Yoğunluğu sabit tutup toparlanmayı izleyin.",
    };
  }

  if (acwr >= 0.8 && acwr <= 1.3) {
    return {
      riskLevel: "optimal",
      summary: "Optimal bölge",
      recommendation: "Program korunabilir.",
      coachNote: "Mevcut yük dengesi sağlıklı.",
    };
  }

  return {
    riskLevel: "low",
    summary: "Düşük yüklenme bölgesi",
    recommendation: "Yük kademeli artırılabilir.",
    coachNote: "Performans gelişimi yavaşlayabilir; kontrollü progresyon değerlendirin.",
  };
}
