/** Koç ödeme kalemi durumu — snapshot lesson satırı ile uyumlu. */
export type CoachPayoutTrackingStatus = "eligible" | "included" | "paid" | null;

/**
 * UI'da "Ödeme Bekliyor" ile aynı mantık (labels.getAccountingCoachPayoutTrackingLabel).
 * Kalemi yok veya veritabanında henüz listeye alınmamış (eligible) durumları.
 */
export function isCoachPayoutTrackingPending(status: CoachPayoutTrackingStatus): boolean {
  return status === null || status === "eligible";
}
