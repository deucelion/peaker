"use client";

import { submitWellnessReportToday } from "@/lib/actions/wellnessFormActions";
import { submitAthleteTrainingLoadSurvey } from "@/lib/actions/trainingLoadSurveyActions";
import { setAttendanceStatus } from "@/lib/actions/attendanceActions";
import { saveAthleticFieldResults, type AthleticResultCell } from "@/lib/actions/athleticFieldActions";
import { createAthleteProgram } from "@/lib/actions/programActions";
import {
  classifyReplayFailure,
  statusFromFailureKind,
  type ReplayFailureKind,
} from "@/lib/offline/conflictMapping";
import { isDuplicateSuccessMessage } from "@/lib/offline/replayPolicy";
import type { OfflineActionKind } from "@/lib/offline/types";

export type ReplayHandlerResult =
  | { ok: true }
  | { ok: false; message: string; failureKind: ReplayFailureKind };

export async function replayOfflineActionByKind(
  kind: OfflineActionKind,
  payload: Record<string, unknown>
): Promise<ReplayHandlerResult> {
  switch (kind) {
    case "wellness_draft": {
      const form = payload.form as
        | {
            fatigue: number;
            sleep_quality: number;
            muscle_soreness: number;
            stress_level: number;
            energy_level: number;
            resting_heart_rate: number;
          }
        | undefined;
      if (!form) {
        return { ok: false, message: "Sabah raporu verisi eksik.", failureKind: "validation_error" };
      }
      const res = await submitWellnessReportToday(form);
      if ("error" in res && res.error) {
        const failureKind = classifyReplayFailure(res.error);
        if (failureKind === "conflict" && isDuplicateSuccessMessage(res.error)) return { ok: true };
        return { ok: false, message: res.error, failureKind };
      }
      return { ok: true };
    }
    case "rpe_draft": {
      const res = await submitAthleteTrainingLoadSurvey({
        durationMinutes: Number(payload.durationMinutes) || 0,
        rpeScore: Number(payload.rpeScore) || 0,
        sessionType: String(payload.sessionType || "Antrenman"),
        sessionDate: String(payload.sessionDate || ""),
      });
      if ("error" in res && res.error) {
        const failureKind = classifyReplayFailure(res.error);
        if (failureKind === "conflict" && isDuplicateSuccessMessage(res.error)) return { ok: true };
        return { ok: false, message: res.error, failureKind };
      }
      return { ok: true };
    }
    case "attendance_draft": {
      const trainingId = String(payload.trainingId || "");
      const profileId = String(payload.profileId || "");
      const status = payload.status as "registered" | "attended" | "missed" | "cancelled";
      if (!trainingId || !profileId || !status) {
        return { ok: false, message: "Yoklama verisi eksik.", failureKind: "validation_error" };
      }
      const res = await setAttendanceStatus(trainingId, profileId, status);
      if ("error" in res && res.error) {
        const failureKind = classifyReplayFailure(res.error);
        return { ok: false, message: res.error, failureKind };
      }
      return { ok: true };
    }
    case "field_test_draft": {
      const testDate = String(payload.testDate || "");
      const selectedProfileIds = (payload.selectedProfileIds as string[]) || [];
      const cells = (payload.cells as AthleticResultCell[]) || [];
      const notes = payload.notes as Array<{ profileId: string; note: string | null }> | undefined;
      if (!testDate || selectedProfileIds.length === 0 || cells.length === 0) {
        return { ok: false, message: "Saha testi verisi eksik.", failureKind: "validation_error" };
      }
      const res = await saveAthleticFieldResults({
        testDate,
        selectedProfileIds,
        cells,
        notes,
      });
      if ("error" in res && res.error) {
        return { ok: false, message: res.error, failureKind: classifyReplayFailure(res.error) };
      }
      return { ok: true };
    }
    case "coach_note_draft": {
      const draftId = String(payload.draftId || "");
      const title = String(payload.title || "").trim();
      const content = String(payload.content || "").trim();
      const weekStart = String(payload.weekStart || "").trim();
      const coachId = String(payload.coachId || "").trim();
      const athleteIds = (payload.athleteIds as string[]) || [];
      if (!title || !content || !weekStart || !coachId || athleteIds.length === 0) {
        return { ok: false, message: "Koç notu verisi eksik.", failureKind: "validation_error" };
      }
      const fd = new FormData();
      fd.append("title", title);
      fd.append("content", content);
      fd.append("weekStart", weekStart);
      fd.append("coachId", coachId);
      if (draftId) fd.append("offlineDraftId", draftId);
      athleteIds.forEach((id) => fd.append("athleteIds", id));
      const res = await createAthleteProgram(fd);
      if (!res?.success) {
        const err = res?.error || "Program kaydedilemedi.";
        const failureKind = classifyReplayFailure(err);
        if (failureKind === "conflict" && isDuplicateSuccessMessage(err)) return { ok: true };
        return { ok: false, message: err, failureKind };
      }
      return { ok: true };
    }
    default:
      return {
        ok: false,
        message: "Bu işlem için otomatik senkron henüz tanımlı değil.",
        failureKind: "retryable_error",
      };
  }
}

export function replayStatusFromHandler(result: ReplayHandlerResult) {
  if (result.ok) return "completed" as const;
  return statusFromFailureKind(result.failureKind);
}
