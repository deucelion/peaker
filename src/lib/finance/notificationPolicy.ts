export type FinancialEventType =
  | "payment_created"
  | "payment_status_updated"
  | "planned_payment_marked_paid"
  | "manual_adjustment";

export type FinancialPaymentScope = "membership" | "private_lesson" | "extra_charge";

export type FinancialPaymentKind =
  | "monthly_membership"
  | "private_lesson_package"
  | "license"
  | "event"
  | "equipment"
  | "manual_other";

export function shouldNotifyFinancialEvent(
  eventType: FinancialEventType,
  paymentScope: FinancialPaymentScope,
  paymentKind: FinancialPaymentKind
): boolean {
  if (paymentScope === "extra_charge") return false;
  if (eventType === "manual_adjustment") return false;
  if (paymentScope === "membership" && paymentKind === "monthly_membership") return true;
  if (paymentScope === "private_lesson" && paymentKind === "private_lesson_package") {
    return eventType !== "payment_status_updated";
  }
  return false;
}
