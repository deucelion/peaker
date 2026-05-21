"use client";

import { enqueueOfflineAction } from "@/lib/offline/offlineActionQueue";
import { attendanceIdempotencyKey } from "@/lib/offline/draftKeys";
import { saveScopedFormDraft } from "@/lib/offline/scopedFormDrafts";

export type AttendanceDraftPayload = {
  trainingId: string;
  lessonTitle?: string;
  statuses: Record<string, "registered" | "attended" | "missed" | "cancelled">;
  updatedAt: string;
};

export function persistAttendanceDraft(
  scopeKey: string,
  draftKey: string,
  payload: AttendanceDraftPayload
): void {
  saveScopedFormDraft(scopeKey, draftKey, payload as unknown as Record<string, unknown>);
}

export function enqueueAttendanceChange(input: {
  scopeKey: string;
  trainingId: string;
  profileId: string;
  profileName?: string;
  status: "registered" | "attended" | "missed" | "cancelled";
  lessonTitle?: string;
}): { ok: true } | { error: string } {
  const queued = enqueueOfflineAction({
    kind: "attendance_draft",
    scopeKey: input.scopeKey,
    idempotencyKey: attendanceIdempotencyKey(input.trainingId, input.profileId, input.status),
    payload: {
      trainingId: input.trainingId,
      profileId: input.profileId,
      status: input.status,
      lessonTitle: input.lessonTitle,
      athleteName: input.profileName,
    },
    title: input.profileName
      ? `Yoklama · ${input.profileName}`
      : "Yoklama taslağı",
  });
  if ("error" in queued) return { error: queued.error };
  return { ok: true };
}
