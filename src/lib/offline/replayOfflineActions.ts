"use client";

import { canAutoReplayKind } from "@/lib/offline/actionRegistry";
import {
  clearOfflineAction,
  listOfflineActions,
  updateOfflineAction,
} from "@/lib/offline/offlineActionQueue";
import { replayOfflineActionByKind } from "@/lib/offline/replayHandlers";
import {
  canAutoReplayNow,
  OFFLINE_MAX_RETRIES,
  replayBackoffMs,
  shouldAutoRetryFailure,
} from "@/lib/offline/replayPolicy";
import {
  trackOfflineReplayBatch,
  trackOfflineReplayFailure,
} from "@/lib/monitoring/runtime";
import type { OfflineReplayResult } from "@/lib/offline/types";

export async function replayOfflineActions(options: {
  scopeKey: string;
  includeConfirmation?: boolean;
  onlyIds?: string[];
}): Promise<OfflineReplayResult> {
  const batchStarted = Date.now();
  const result: OfflineReplayResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    skippedConfirmation: 0,
    errors: [],
    lastSyncAt: null,
  };

  let candidates = listOfflineActions(options.scopeKey).filter((item) => {
    if (options.onlyIds?.length) return options.onlyIds.includes(item.id);
    if (item.status === "requires_confirmation" && !options.includeConfirmation) {
      result.skippedConfirmation += 1;
      return false;
    }
    if (item.status === "completed") return false;
    if (item.status === "requires_confirmation") return options.includeConfirmation === true;
    return item.status === "pending" || item.status === "failed" || item.status === "conflict";
  });

  if (!options.includeConfirmation) {
    candidates = candidates.filter((item) => canAutoReplayKind(item.kind) && item.risk === "safe");
  }

  for (const item of candidates) {
    if (!options.includeConfirmation && !canAutoReplayNow(item)) {
      continue;
    }
    if (item.retries >= OFFLINE_MAX_RETRIES) {
      result.failed += 1;
      result.errors.push({
        id: item.id,
        message: "Maksimum deneme sayısına ulaşıldı.",
        failureKind: "retryable_error",
      });
      continue;
    }

    result.processed += 1;
    updateOfflineAction(item.id, { status: "syncing", lastError: null, lastAttemptAt: new Date().toISOString() });

    try {
      const replay = await replayOfflineActionByKind(item.kind, item.payload);
      if (replay.ok) {
        clearOfflineAction(item.id);
        result.succeeded += 1;
      } else {
        const autoRetry = shouldAutoRetryFailure(replay.failureKind);
        const status =
          replay.failureKind === "conflict"
            ? "conflict"
            : !autoRetry
              ? replay.failureKind === "validation_error" || replay.failureKind === "permission_denied"
                ? "failed"
                : "failed"
              : "failed";

        updateOfflineAction(item.id, {
          status,
          retries: item.retries + 1,
          lastError: replay.message,
          lastAttemptAt: new Date().toISOString(),
        });
        result.failed += 1;
        trackOfflineReplayFailure({
          kind: item.kind,
          failureKind: replay.failureKind,
          scope: { organizationId: options.scopeKey.split(":")[0] ?? null },
        });
        result.errors.push({
          id: item.id,
          message: replay.message,
          failureKind: replay.failureKind,
        });

        if (autoRetry && item.retries + 1 < OFFLINE_MAX_RETRIES) {
          const waitMs = replayBackoffMs(item.retries + 1);
          await new Promise((r) => setTimeout(r, Math.min(waitMs, 2000)));
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Senkron hatası";
      updateOfflineAction(item.id, {
        status: "failed",
        retries: item.retries + 1,
        lastError: message,
        lastAttemptAt: new Date().toISOString(),
      });
      result.failed += 1;
      result.errors.push({ id: item.id, message, failureKind: "retryable_error" });
    }
  }

  if (result.succeeded > 0) {
    result.lastSyncAt = new Date().toISOString();
  }

  trackOfflineReplayBatch({
    processed: result.processed,
    succeeded: result.succeeded,
    failed: result.failed,
    durationMs: Date.now() - batchStarted,
    scope: { organizationId: options.scopeKey.split(":")[0] ?? null },
  });

  return result;
}
