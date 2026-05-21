/**
 * Cross-tab finance invalidation (BroadcastChannel). Tenant-scoped by organizationId.
 */

export const FINANCE_BROADCAST_CHANNEL = "peaker_finance_v1";

export type FinanceBroadcastPayload = {
  t: "touch";
  organizationId: string;
  source?: string;
  at: number;
};

export function postFinanceTouch(organizationId: string, source?: string): void {
  if (typeof BroadcastChannel === "undefined") return;
  try {
    const bc = new BroadcastChannel(FINANCE_BROADCAST_CHANNEL);
    const payload: FinanceBroadcastPayload = {
      t: "touch",
      organizationId,
      source,
      at: Date.now(),
    };
    bc.postMessage(payload);
    bc.close();
  } catch {
    /* ignore quota / private mode */
  }
}

export function subscribeFinanceTouches(handler: (organizationId: string) => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  let closed = false;
  const bc = new BroadcastChannel(FINANCE_BROADCAST_CHANNEL);
  bc.onmessage = (ev: MessageEvent<unknown>) => {
    const d = ev.data as Partial<FinanceBroadcastPayload> | null;
    if (!d || d.t !== "touch" || typeof d.organizationId !== "string") return;
    handler(d.organizationId);
  };
  return () => {
    if (closed) return;
    closed = true;
    bc.close();
  };
}
