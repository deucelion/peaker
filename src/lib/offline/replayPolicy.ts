import type { ReplayFailureKind } from "@/lib/offline/conflictMapping";

export const OFFLINE_MAX_RETRIES = 5;

export function replayBackoffMs(retries: number): number {
  return Math.min(30_000, 500 * 2 ** Math.max(0, retries));
}

export function shouldAutoRetryFailure(kind: ReplayFailureKind): boolean {
  return kind === "retryable_error";
}

export function canAutoReplayNow(item: { retries: number; lastAttemptAt?: string | null }): boolean {
  if (item.retries <= 0) return true;
  if (!item.lastAttemptAt) return true;
  const elapsed = Date.now() - new Date(item.lastAttemptAt).getTime();
  return elapsed >= replayBackoffMs(item.retries);
}

export function isDuplicateSuccessMessage(message: string): boolean {
  const m = message.toLowerCase();
  return /zaten|duplicate|mevcut kayıt|no changes/i.test(m);
}
