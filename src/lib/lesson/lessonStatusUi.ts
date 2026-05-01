import type { LessonStatus } from "@/lib/types/lesson";

export function lessonStatusLabelTr(status: LessonStatus): string {
  switch (status) {
    case "scheduled":
      return "Planlandı";
    case "completed":
      return "Tamamlandı";
    case "cancelled":
      return "İptal Edildi";
    default:
      return status;
  }
}

/** Liste / özet rozetleri için mevcut `ui-badge-*` sınıflarıyla uyumlu. */
export function lessonStatusBadgeClass(status: LessonStatus): string {
  if (status === "cancelled") return "ui-badge-danger";
  if (status === "completed") return "ui-badge-neutral";
  return "ui-badge-success";
}
