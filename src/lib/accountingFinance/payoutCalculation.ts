export type CoachPaymentRuleForCalc = {
  payment_type: "per_lesson" | "percentage";
  amount: number | null;
  percentage: number | null;
  applies_to: "group" | "private" | "all";
};

export type LessonInputForPayout = {
  sourceType: "group" | "private";
  status: "planned" | "completed" | "cancelled";
  lessonUnitPrice: number | null;
};

export type PayoutCalculationResult = {
  payoutAmount: number;
  calculationStatus: "ok" | "no_rule" | "no_price" | "not_eligible";
};

export function pickCoachRule(
  rules: CoachPaymentRuleForCalc[],
  coachId: string | null,
  sourceType: "group" | "private"
): CoachPaymentRuleForCalc | null {
  if (!coachId) return null;
  const forCoach = rules; // caller passes already filtered by coach
  const specific =
    sourceType === "group"
      ? forCoach.find((r) => r.applies_to === "group")
      : forCoach.find((r) => r.applies_to === "private");
  if (specific) return specific;
  return forCoach.find((r) => r.applies_to === "all") || null;
}

/**
 * Para hesaplama: kural ve ders fiyatına göre koç payı.
 * Tamamlanmamış / iptal derslerde hesaplama yapılmaz (0, not_eligible).
 */
export function calculateCoachPayout(
  lesson: LessonInputForPayout,
  coachRule: CoachPaymentRuleForCalc | null
): PayoutCalculationResult {
  if (lesson.status !== "completed") {
    return { payoutAmount: 0, calculationStatus: "not_eligible" };
  }
  if (!coachRule) {
    return { payoutAmount: 0, calculationStatus: "no_rule" };
  }
  const price = lesson.lessonUnitPrice;
  if (price == null || !Number.isFinite(price) || price <= 0) {
    return { payoutAmount: 0, calculationStatus: "no_price" };
  }
  if (coachRule.payment_type === "per_lesson") {
    const amt = Number(coachRule.amount || 0);
    return { payoutAmount: Number.isFinite(amt) && amt > 0 ? amt : 0, calculationStatus: "ok" };
  }
  const pct = Number(coachRule.percentage || 0);
  if (!Number.isFinite(pct) || pct <= 0) {
    return { payoutAmount: 0, calculationStatus: "ok" };
  }
  const payout = (price * pct) / 100;
  return { payoutAmount: Math.round(payout * 100) / 100, calculationStatus: "ok" };
}
