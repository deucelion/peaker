import type { RiskStatsSummary } from "@/lib/performance/loadSeries";

export type DecisionLevel = "ok" | "watch" | "risk" | "nodata";

export type OverallPerformanceDecision = {
  level: DecisionLevel;
  headline: string;
  detail: string;
};

function lastAcwrRatio(rows: { ratio: number }[]): number | null {
  if (!rows.length) return null;
  const v = rows[rows.length - 1]?.ratio;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function lastEwmaRatio(rows: { ewmaRatio: number }[]): number | null {
  if (!rows.length) return null;
  const v = rows[rows.length - 1]?.ewmaRatio;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Genel durum: ACWR/EWMA risk günleri, son oranlar, monotoni, strain, streak, readiness.
 */
export function deriveOverallPerformanceDecision(params: {
  loadKpisAvailable: boolean;
  readinessHasData: boolean;
  riskStats: RiskStatsSummary;
  latestAcwrRatio: number | null;
  latestEwmaRatio: number | null;
}): OverallPerformanceDecision {
  const { loadKpisAvailable, readinessHasData, riskStats, latestAcwrRatio, latestEwmaRatio } = params;

  if (!loadKpisAvailable && !readinessHasData) {
    return {
      level: "nodata",
      headline: "Veri bekleniyor",
      detail: "Bu dönemde yük veya wellness kaydı yok. İdman raporu ve sabah formu ile karar desteği oluşur.",
    };
  }

  const criticalHeavy = riskStats.critical >= 2 || riskStats.ewmaRisk >= 2;
  const criticalLight = riskStats.critical >= 1 || riskStats.ewmaRisk >= 1;
  const strainHigh = riskStats.strain != null && riskStats.strain >= 4000;
  const strainWatch = riskStats.strain != null && riskStats.strain >= 2800;
  const monoHigh = riskStats.monotony != null && riskStats.monotony >= 2.25;
  const monoWatch = riskStats.monotony != null && riskStats.monotony >= 1.85;
  const spike = latestAcwrRatio != null && latestAcwrRatio > 1.5;
  const ewSpike = latestEwmaRatio != null && latestEwmaRatio > 1.5;
  const streakBad = riskStats.highRiskStreak >= 3;
  const readinessLow = readinessHasData && riskStats.readiness < 55;
  const rpeHigh = riskStats.avgRpe != null && riskStats.avgRpe >= 7.5;

  const risk =
    criticalHeavy ||
    strainHigh ||
    (monoHigh && criticalLight) ||
    streakBad ||
    (spike && ewSpike) ||
    (spike && strainWatch);

  if (risk) {
    return {
      level: "risk",
      headline: "Yüklenme riski yüksek",
      detail:
        "ACWR/EWMA risk günleri, strain veya üst üste risk serisi eşikleri aşıldı. Hacim veya yoğunluğu azaltıp toparlanmayı güçlendirin.",
    };
  }

  const watch =
    criticalLight ||
    strainWatch ||
    monoWatch ||
    spike ||
    ewSpike ||
    rpeHigh ||
    readinessLow;

  if (watch) {
    return {
      level: "watch",
      headline: "Dikkat: yük veya toparlanma baskısı",
      detail:
        "Bazı göstergeler sarı bölgede. Antrenman çeşitliliği, hafif gün ve wellness takibini artırmanız önerilir.",
    };
  }

  return {
    level: "ok",
    headline: "Yük dengesi genel olarak stabil",
    detail: "Kritik eşikler aşılmadı. Mevcut plan güvenle sürdürülebilir; rutin wellness takibini koruyun.",
  };
}

export type KpiNarratives = {
  acwr: { primary: string; status: string; detail: string; tone: "red" | "amber" | "green" | "neutral" };
  sweet: { primary: string; status: string; detail: string; tone: "red" | "amber" | "green" | "neutral" };
  rpe: { primary: string; status: string; detail: string; tone: "red" | "amber" | "green" | "neutral" };
  ewma: { primary: string; status: string; detail: string; tone: "red" | "amber" | "green" | "neutral" };
  readiness: { primary: string; status: string; detail: string; tone: "red" | "amber" | "green" | "neutral" };
  monotony: { primary: string; status: string; detail: string; tone: "red" | "amber" | "green" | "neutral" };
  strain: { primary: string; status: string; detail: string; tone: "red" | "amber" | "green" | "neutral" };
  critical: { primary: string; status: string; detail: string; tone: "red" | "amber" | "green" | "neutral" };
};

function toneFromAcwr(r: number | null): KpiNarratives["acwr"]["tone"] {
  if (r == null) return "neutral";
  if (r > 1.5) return "red";
  if (r >= 0.8 && r <= 1.3) return "green";
  if (r >= 1.3 && r <= 1.5) return "amber";
  return "amber";
}

export function buildKpiNarratives(params: {
  loadKpisAvailable: boolean;
  readinessHasData: boolean;
  riskStats: RiskStatsSummary;
  acwrSeries: { ratio: number }[];
  ewmaSeries: { ewmaRatio: number }[];
}): KpiNarratives {
  const { loadKpisAvailable, readinessHasData, riskStats, acwrSeries, ewmaSeries } = params;
  const acwrR = lastAcwrRatio(acwrSeries);
  const ewR = lastEwmaRatio(ewmaSeries);

  const empty = (): KpiNarratives["acwr"] => ({
    primary: "—",
    status: "",
    detail: "Veri yok — idman raporu girildiğinde oluşur.",
    tone: "neutral",
  });

  if (!loadKpisAvailable) {
    const e = empty();
    return {
      acwr: e,
      sweet: e,
      rpe: e,
      ewma: e,
      readiness: readinessNarrative(riskStats, readinessHasData),
      monotony: e,
      strain: e,
      critical: e,
    };
  }

  const acwrTone = toneFromAcwr(acwrR);
  const acwrStatus =
    acwrR == null
      ? ""
      : acwrR > 1.5
        ? "Yüksek risk"
        : acwrR >= 0.8 && acwrR <= 1.3
          ? "Optimal bant"
          : acwrR < 0.8
            ? "Düşük yük"
            : "Dikkat bandı";
  const acwrDetail =
    acwrR == null
      ? "Seri uç noktası hesaplanamadı."
      : acwrR > 1.5
        ? "Son 7 gün yükü kroniğe göre yüksek; müdahale düşünün."
        : acwrR >= 0.8 && acwrR <= 1.3
          ? "Akut/kronik oranı hedef aralıkta."
          : acwrR < 0.8
            ? "Tetiklenebilir kapasite düşük; gerektiğinde hacim artırılabilir."
            : "Kroniğe göre akut yük yükseliyor; izleyin.";

  const ewTone = toneFromAcwr(ewR);
  const ewStatus =
    ewR == null ? "" : ewR > 1.5 ? "Yüksek risk" : ewR >= 0.8 && ewR <= 1.3 ? "Dengeli" : ewR < 0.8 ? "Düşük" : "Dikkat";
  const ewDetail =
    ewR == null
      ? "EWMA oranı hesaplanamadı."
      : ewR > 1.5
        ? "Kısa vadeli ağırlıklı yük uzun vadeden belirgin yüksek."
        : "Kısa/uzun vadeli yük dengesi izlenebilir.";

  const sweetTone: KpiNarratives["sweet"]["tone"] =
    riskStats.sweetSpot > riskStats.critical ? "green" : riskStats.critical > 0 ? "amber" : "neutral";
  const sweetStatus =
    riskStats.sweetSpot > riskStats.critical ? "İyi dağılım" : riskStats.critical > 0 ? "Risk baskın" : "Nötr";
  const sweetDetail =
    riskStats.sweetSpot > riskStats.critical
      ? "Çoğu gün optimal ACWR bandında."
      : "Optimal gün sayısı riskli günlere göre düşük.";

  const rpe = riskStats.avgRpe;
  const rpeTone: KpiNarratives["rpe"]["tone"] =
    rpe == null ? "neutral" : rpe >= 8 ? "red" : rpe >= 6.5 ? "amber" : "green";
  const rpeStatus = rpe == null ? "" : rpe >= 8 ? "Yüksek" : rpe >= 6.5 ? "Orta–yüksek" : "Kontrollü";
  const rpeDetail =
    rpe == null
      ? "RPE girilmemiş seanslar ortalamayı düşürür."
      : rpe >= 8
        ? "Yoğun antrenman dönemi; toparlanmayı güçlendirin."
        : "Seans zorluğu genel olarak sürdürülebilir.";

  const critTone: KpiNarratives["critical"]["tone"] =
    riskStats.critical >= 2 ? "red" : riskStats.critical >= 1 ? "amber" : "green";
  const critStatus =
    riskStats.critical >= 2 ? "Yüksek alarm" : riskStats.critical === 1 ? "Dikkat" : "Düşük";
  const critDetail =
    riskStats.critical >= 1
      ? "Seçili dönemde ACWR > 1,5 günleri var."
      : "Bu dönemde kritik ACWR günü yok.";

  const mono = riskStats.monotony;
  const monoTone: KpiNarratives["monotony"]["tone"] =
    mono == null ? "neutral" : mono >= 2.25 ? "red" : mono >= 1.85 ? "amber" : "green";
  const monoStatus = mono == null ? "" : mono >= 2.25 ? "Çok tekrarlı" : mono >= 1.85 ? "Tekrarlı" : "Çeşitli";
  const monoDetail =
    mono == null
      ? "Standart sapma 0 veya veri yetersiz."
      : mono >= 2.25
        ? "Haftalık yük çok benzer; çeşitlilik ekleyin."
        : "Yük değişkenliği kabul edilebilir.";

  const st = riskStats.strain;
  const stTone: KpiNarratives["strain"]["tone"] =
    st == null ? "neutral" : st >= 4000 ? "red" : st >= 2800 ? "amber" : "green";
  const stStatus = st == null ? "" : st >= 4000 ? "Yüksek strain" : st >= 2800 ? "Sınırda" : "Kontrollü";
  const stDetail =
    st == null
      ? "Monotoni veya yük eksik."
      : st >= 4000
        ? "Hacim × monotoni yüksek; hafifletme düşünün."
        : "Strain bu dönem için makul görünüyor.";

  return {
    acwr: {
      primary: acwrR != null ? acwrR.toFixed(2) : "—",
      status: acwrStatus,
      detail: acwrDetail,
      tone: acwrTone,
    },
    sweet: {
      primary: String(riskStats.sweetSpot),
      status: sweetStatus,
      detail: sweetDetail,
      tone: sweetTone,
    },
    rpe: {
      primary: rpe != null ? String(rpe) : "—",
      status: rpeStatus,
      detail: rpeDetail,
      tone: rpeTone,
    },
    ewma: {
      primary: ewR != null ? ewR.toFixed(2) : "—",
      status: ewStatus,
      detail: ewDetail,
      tone: ewTone,
    },
    readiness: readinessNarrative(riskStats, readinessHasData),
    monotony: {
      primary: mono != null ? String(mono) : "—",
      status: monoStatus,
      detail: monoDetail,
      tone: monoTone,
    },
    strain: {
      primary: st != null ? String(st) : "—",
      status: stStatus,
      detail: stDetail,
      tone: stTone,
    },
    critical: {
      primary: String(riskStats.critical),
      status: critStatus,
      detail: critDetail,
      tone: critTone,
    },
  };
}

function readinessNarrative(riskStats: RiskStatsSummary, readinessHasData: boolean): KpiNarratives["readiness"] {
  if (!readinessHasData) {
    return {
      primary: "—",
      status: "",
      detail: "Wellness kaydı yok — sabah raporu ile güncellenir.",
      tone: "neutral",
    };
  }
  const s = riskStats.readiness;
  const tone: KpiNarratives["readiness"]["tone"] = s >= 70 ? "green" : s >= 55 ? "amber" : "red";
  const status = s >= 70 ? "İyi" : s >= 55 ? "Orta" : "Düşük";
  const detail =
    s >= 70
      ? "Wellness bileşenleri toparlanmayı destekliyor."
      : "Wellness verilerine göre toparlanma zayıf; uyku ve hafif gün önerilir.";
  return { primary: String(s), status, detail, tone };
}

export function derivePerformanceRecommendations(params: {
  loadKpisAvailable: boolean;
  readinessHasData: boolean;
  riskStats: RiskStatsSummary;
  latestAcwrRatio: number | null;
  latestEwmaRatio: number | null;
}): string[] {
  const out: string[] = [];
  const { loadKpisAvailable, readinessHasData, riskStats, latestAcwrRatio, latestEwmaRatio } = params;

  if (!loadKpisAvailable && !readinessHasData) {
    return ["Önce idman raporu veya wellness girişi yapın; karar özeti buna bağlıdır."];
  }

  if (riskStats.highRiskStreak >= 3) {
    out.push("Üst üste yüksek risk: en az bir toparlanma / hafif hafta planlayın.");
  }
  if (riskStats.critical >= 1 || (latestAcwrRatio != null && latestAcwrRatio > 1.5)) {
    out.push("Yük azaltımı veya yoğunluk düşürümü önerilir (ACWR riski).");
  }
  if (riskStats.ewmaRisk >= 1 || (latestEwmaRatio != null && latestEwmaRatio > 1.5)) {
    out.push("EWMA riski: kısa vadeli yükü kademeli azaltın.");
  }
  if (riskStats.monotony != null && riskStats.monotony >= 2) {
    out.push("Monotoni yüksek: antrenman çeşitliliği ve farklı stimülasyonlar ekleyin.");
  }
  if (riskStats.strain != null && riskStats.strain >= 3500) {
    out.push("Strain yüksek: haftalık toplam yük veya tekrarlılığı azaltın.");
  }
  if (riskStats.avgRpe != null && riskStats.avgRpe >= 7.5) {
    out.push("Ortalama RPE yüksek: yoğun antrenman döneminde seans süresi veya şiddeti hafifletin.");
  }
  if (readinessHasData && riskStats.readiness < 55) {
    out.push("Readiness düşük: uyku, beslenme ve wellness takibini güçlendirin.");
  }

  if (
    loadKpisAvailable &&
    riskStats.critical === 0 &&
    riskStats.ewmaRisk === 0 &&
    (riskStats.strain == null || riskStats.strain < 2800) &&
    (!readinessHasData || riskStats.readiness >= 60)
  ) {
    out.push("Yük dengesi stabil görünüyor; mevcut plan güvenle sürdürülebilir.");
  }

  const uniq = [...new Set(out)];
  return uniq.slice(0, 6);
}
