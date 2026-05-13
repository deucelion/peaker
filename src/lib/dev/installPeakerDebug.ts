import { getSystemOperationsSnapshot } from "@/lib/actions/systemOperationsActions";

export type PeakerDebugApi = {
  getSystemSnapshot: typeof getSystemOperationsSnapshot;
};

declare global {
  interface Window {
    __PEAKER_DEBUG__?: PeakerDebugApi;
  }
}

/** Sadece development client bundle’ında çağrılmalı. */
export function installPeakerDebug(): void {
  if (typeof window === "undefined" || process.env.NODE_ENV === "production") return;
  window.__PEAKER_DEBUG__ = {
    getSystemSnapshot: getSystemOperationsSnapshot,
  };
}
