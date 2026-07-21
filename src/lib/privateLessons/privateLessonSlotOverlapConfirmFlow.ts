import { previewPrivateLessonCoachSlotOverlaps } from "@/lib/actions/privateLessonSessionActions";
import type { PrivateLessonSlotOverlapPreviewResult } from "@/lib/privateLessons/privateLessonSlotOverlap";

export type PrivateLessonSlotOverlapConfirmState = {
  preview: PrivateLessonSlotOverlapPreviewResult;
  resolve: (proceed: boolean) => void;
};

export async function preparePrivateLessonSlotOverlapConfirm(formData: FormData): Promise<
  | { kind: "proceed" }
  | { kind: "error"; message: string }
  | { kind: "confirm"; preview: PrivateLessonSlotOverlapPreviewResult }
> {
  const preview = await previewPrivateLessonCoachSlotOverlaps(formData);
  if ("error" in preview) {
    return { kind: "error", message: preview.error };
  }
  if (preview.overlappingCount <= 0) {
    return { kind: "proceed" };
  }
  return { kind: "confirm", preview };
}

export function waitForSlotOverlapConfirm(
  preview: PrivateLessonSlotOverlapPreviewResult,
  setDialog: (state: PrivateLessonSlotOverlapConfirmState | null) => void
): Promise<boolean> {
  return new Promise((resolve) => {
    setDialog({
      preview,
      resolve: (proceed) => {
        setDialog(null);
        resolve(proceed);
      },
    });
  });
}

export async function runPrivateLessonCreateWithSlotConfirm(
  formData: FormData,
  setDialog: (state: PrivateLessonSlotOverlapConfirmState | null) => void
): Promise<{ proceed: boolean; previewError?: string }> {
  const prep = await preparePrivateLessonSlotOverlapConfirm(formData);
  if (prep.kind === "error") {
    return { proceed: false, previewError: prep.message };
  }
  if (prep.kind === "proceed") {
    return { proceed: true };
  }
  const ok = await waitForSlotOverlapConfirm(prep.preview, setDialog);
  return { proceed: ok };
}
