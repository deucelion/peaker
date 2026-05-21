import type { ReplayFailureKind } from "@/lib/offline/conflictMapping";

export type OfflineActionKind =
  | "wellness_draft"
  | "rpe_draft"
  | "attendance_draft"
  | "field_test_draft"
  | "coach_note_draft"
  | "finance_note_draft"
  | "payment_record_draft"
  | "private_lesson_complete_draft"
  | "package_lifecycle_draft";

export type OfflineActionRisk = "safe" | "requires_confirmation" | "blocked";

export type OfflineActionStatus =
  | "pending"
  | "syncing"
  | "failed"
  | "conflict"
  | "requires_confirmation"
  | "completed";

export type OfflineQueuedAction = {
  id: string;
  kind: OfflineActionKind;
  risk: OfflineActionRisk;
  title: string;
  payload: Record<string, unknown>;
  createdAt: string;
  scopeKey: string;
  status: OfflineActionStatus;
  retries: number;
  lastError?: string | null;
  lastAttemptAt?: string | null;
  idempotencyKey?: string | null;
  draftId?: string | null;
  subjectLabel?: string | null;
  navigationHref?: string | null;
};

export type OfflineReplayErrorEntry = {
  id: string;
  message: string;
  failureKind?: ReplayFailureKind;
};

export type OfflineReplayResult = {
  processed: number;
  succeeded: number;
  failed: number;
  skippedConfirmation: number;
  errors: OfflineReplayErrorEntry[];
  lastSyncAt?: string | null;
};
