import type { OfflineActionKind, OfflineQueuedAction } from "@/lib/offline/types";

export function queueItemMetaFromPayload(
  kind: OfflineActionKind,
  payload: Record<string, unknown>
): { subjectLabel?: string; navigationHref?: string } {
  switch (kind) {
    case "attendance_draft": {
      const lesson = String(payload.lessonTitle || payload.trainingTitle || "").trim();
      const athlete = String(payload.athleteName || payload.profileName || "").trim();
      const href = payload.trainingId
        ? `/antrenman-yonetimi?modul=grup-dersleri&view=yoklama&trainingId=${payload.trainingId}`
        : "/antrenman-yonetimi?modul=grup-dersleri&view=yoklama";
      return {
        subjectLabel: [lesson, athlete].filter(Boolean).join(" · ") || undefined,
        navigationHref: href,
      };
    }
    case "field_test_draft": {
      const date = String(payload.testDate || "").trim();
      const count = Array.isArray(payload.selectedProfileIds)
        ? payload.selectedProfileIds.length
        : 0;
      return {
        subjectLabel: date ? `Saha testi · ${date}${count ? ` · ${count} sporcu` : ""}` : undefined,
        navigationHref: "/saha-testleri",
      };
    }
    case "coach_note_draft": {
      const title = String(payload.title || "").trim();
      const athlete = String(payload.athleteName || "").trim();
      return {
        subjectLabel: [title, athlete].filter(Boolean).join(" · ") || "Koç notu",
        navigationHref: "/antrenman-yonetimi?modul=notlar",
      };
    }
    case "wellness_draft":
      return { navigationHref: "/sporcu/sabah-raporu", subjectLabel: "Sabah raporu" };
    case "rpe_draft":
      return { navigationHref: "/anket", subjectLabel: "RPE raporu" };
    default:
      return {};
  }
}

export function enrichQueueItem(item: OfflineQueuedAction): OfflineQueuedAction {
  const meta = queueItemMetaFromPayload(item.kind, item.payload);
  return {
    ...item,
    subjectLabel: item.subjectLabel ?? meta.subjectLabel,
    navigationHref: item.navigationHref ?? meta.navigationHref,
  };
}
