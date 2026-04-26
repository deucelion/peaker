import type { FinanceStatusSummary } from "@/lib/types/finance";

type FinanceVisualTone = "green" | "yellow" | "orange" | "red";

export type FinanceStatusPresentation = {
  label: string;
  tone: FinanceVisualTone;
  badgeClass: string;
  cardClass: string;
  inlineTextClass: string;
  supportText: string;
};

type FinanceSummaryLike = {
  tone?: FinanceStatusSummary["tone"] | null;
  label?: string | null;
} | null | undefined;

const PRESENTATION_BY_LABEL: Record<FinanceStatusSummary["label"], FinanceStatusPresentation> = {
  "Ödeme Tamamlandı": {
    label: "Ödeme Tamamlandı",
    tone: "green",
    badgeClass: "border-emerald-500/35 bg-emerald-500/10 text-emerald-200",
    cardClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    inlineTextClass: "text-emerald-300",
    supportText: "Bu ayın ödemesi tamamlandı.",
  },
  "Ödeme Bekleniyor": {
    label: "Ödeme Bekleniyor",
    tone: "yellow",
    badgeClass: "border-amber-500/35 bg-amber-500/10 text-amber-200",
    cardClass: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    inlineTextClass: "text-amber-300",
    supportText: "Ödeme planı beklemede.",
  },
  "Kısmi Ödeme Var": {
    label: "Kısmi Ödeme Var",
    tone: "orange",
    badgeClass: "border-orange-500/35 bg-orange-500/10 text-orange-200",
    cardClass: "border-orange-500/30 bg-orange-500/10 text-orange-300",
    inlineTextClass: "text-orange-300",
    supportText: "Ödemenin bir kısmı alındı, bakiye devam ediyor.",
  },
  "Gecikmiş Ödeme Var": {
    label: "Gecikmiş Ödeme Var",
    tone: "red",
    badgeClass: "border-rose-500/35 bg-rose-500/10 text-rose-200",
    cardClass: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    inlineTextClass: "text-rose-300",
    supportText: "Ödeme gecikmiş görünüyor.",
  },
  "Borç Bulunmuyor": {
    label: "Borç Bulunmuyor",
    tone: "green",
    badgeClass: "border-emerald-500/35 bg-emerald-500/10 text-emerald-200",
    cardClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    inlineTextClass: "text-emerald-300",
    supportText: "Aktif borç bulunmuyor.",
  },
};

export function getFinanceStatusPresentation(summary?: FinanceSummaryLike): FinanceStatusPresentation {
  if (!summary) return PRESENTATION_BY_LABEL["Ödeme Bekleniyor"];

  // "approaching" tonu kullanıcı dilinde daha anlaşılır olsun.
  if (summary.tone === "approaching") {
    return {
      ...PRESENTATION_BY_LABEL["Ödeme Bekleniyor"],
      label: "Ödeme Yaklaşıyor",
      supportText: "Son ödeme tarihi yaklaşıyor.",
    };
  }

  if (summary.label && summary.label in PRESENTATION_BY_LABEL) {
    return PRESENTATION_BY_LABEL[summary.label as FinanceStatusSummary["label"]];
  }

  if (summary.tone === "overdue") return PRESENTATION_BY_LABEL["Gecikmiş Ödeme Var"];
  if (summary.tone === "paid") return PRESENTATION_BY_LABEL["Ödeme Tamamlandı"];
  return PRESENTATION_BY_LABEL["Ödeme Bekleniyor"];
}
