import { canAutoReplayKind, defaultTitleForKind, riskForKind } from "@/lib/offline/actionRegistry";
import {
  clearOfflineQueueAll,
  getOfflineQueueSnapshot,
  persistOfflineQueue,
  purgeOtherScopes,
} from "@/lib/offline/queueStore";
import type {
  OfflineActionKind,
  OfflineActionStatus,
  OfflineQueuedAction,
} from "@/lib/offline/types";
import { filterQueueForScope } from "@/lib/offline/scope";
import { enrichQueueItem, queueItemMetaFromPayload } from "@/lib/offline/queueItemMeta";

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `off-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export type EnqueueOfflineInput = {
  kind: OfflineActionKind;
  scopeKey: string;
  payload: Record<string, unknown>;
  title?: string;
  idempotencyKey?: string;
  draftId?: string;
  subjectLabel?: string;
  navigationHref?: string;
};

export function listOfflineActions(scopeKey?: string): OfflineQueuedAction[] {
  const all = getOfflineQueueSnapshot();
  if (!scopeKey) return all;
  return filterQueueForScope(all, scopeKey);
}

export async function prepareOfflineQueueForScope(scopeKey: string): Promise<void> {
  const { hydrateOfflineQueue } = await import("@/lib/offline/queueStore");
  await hydrateOfflineQueue(scopeKey);
  await purgeOtherScopes(scopeKey);
}

export function enqueueOfflineAction(input: EnqueueOfflineInput): OfflineQueuedAction | { error: string } {
  const risk = riskForKind(input.kind);
  if (risk === "blocked") {
    return {
      error:
        "Bu işlem çevrimdışı otomatik gönderilemez. Bağlantı gelince ilgili ekrandan tekrar deneyin.",
    };
  }

  const status: OfflineActionStatus =
    risk === "requires_confirmation" ? "requires_confirmation" : "pending";

  const meta = queueItemMetaFromPayload(input.kind, input.payload);
  const idempotencyKey = input.idempotencyKey?.trim() || null;

  const queue = getOfflineQueueSnapshot();
  if (idempotencyKey) {
    const existingIdx = queue.findIndex(
      (q) =>
        q.scopeKey === input.scopeKey &&
        q.idempotencyKey === idempotencyKey &&
        q.status !== "completed"
    );
    if (existingIdx >= 0) {
      const prev = queue[existingIdx];
      const updated: OfflineQueuedAction = enrichQueueItem({
        ...prev,
        payload: input.payload,
        title: input.title?.trim() || prev.title,
        status,
        lastError: null,
        draftId: input.draftId ?? prev.draftId,
        subjectLabel: input.subjectLabel ?? meta.subjectLabel ?? prev.subjectLabel,
        navigationHref: input.navigationHref ?? meta.navigationHref ?? prev.navigationHref,
      });
      queue[existingIdx] = updated;
      void persistOfflineQueue(queue);
      return updated;
    }
  }

  const item: OfflineQueuedAction = enrichQueueItem({
    id: newId(),
    kind: input.kind,
    risk,
    title: input.title?.trim() || defaultTitleForKind(input.kind),
    payload: input.payload,
    createdAt: new Date().toISOString(),
    scopeKey: input.scopeKey,
    status,
    retries: 0,
    lastError: null,
    lastAttemptAt: null,
    idempotencyKey,
    draftId: input.draftId ?? null,
    subjectLabel: input.subjectLabel ?? meta.subjectLabel ?? null,
    navigationHref: input.navigationHref ?? meta.navigationHref ?? null,
  });

  queue.push(item);
  void persistOfflineQueue(queue);
  return item;
}

export function updateOfflineAction(
  id: string,
  patch: Partial<Pick<OfflineQueuedAction, "status" | "retries" | "lastError" | "lastAttemptAt">>
): void {
  const queue = getOfflineQueueSnapshot();
  const next = queue.map((item) => (item.id === id ? { ...item, ...patch } : item));
  void persistOfflineQueue(next);
}

export function clearOfflineAction(id: string): void {
  void persistOfflineQueue(getOfflineQueueSnapshot().filter((item) => item.id !== id));
}

export async function clearOfflineActionsForScope(scopeKey: string): Promise<void> {
  await persistOfflineQueue(getOfflineQueueSnapshot().filter((item) => item.scopeKey !== scopeKey));
}

export async function clearAllOfflineActions(): Promise<void> {
  await clearOfflineQueueAll();
}

export function countPendingOfflineActions(scopeKey?: string): number {
  return listOfflineActions(scopeKey).filter(
    (item) =>
      item.status === "pending" ||
      item.status === "failed" ||
      item.status === "requires_confirmation" ||
      item.status === "conflict"
  ).length;
}

export function listAutoReplayCandidates(scopeKey: string): OfflineQueuedAction[] {
  return listOfflineActions(scopeKey).filter(
    (item) =>
      item.status === "pending" &&
      canAutoReplayKind(item.kind) &&
      item.risk === "safe"
  );
}
