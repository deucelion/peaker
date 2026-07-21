import { previewPrivateLessonCoachSlotOverlaps } from "@/lib/actions/privateLessonSessionActions";
import { privateLessonSlotOverlapWarningMessage } from "@/lib/privateLessons/privateLessonSlotOverlap";

export async function confirmPrivateLessonSlotOverlapIfNeeded(
  formData: FormData
): Promise<{ proceed: boolean; previewError?: string }> {
  const preview = await previewPrivateLessonCoachSlotOverlaps(formData);
  if ("error" in preview) {
    return { proceed: false, previewError: preview.error };
  }
  if (preview.overlappingCount <= 0) {
    return { proceed: true };
  }
  const msg = privateLessonSlotOverlapWarningMessage(preview.overlappingCount);
  if (!msg) return { proceed: true };
  if (typeof window === "undefined") return { proceed: true };
  return { proceed: window.confirm(msg) };
}
