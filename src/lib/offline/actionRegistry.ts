import type { OfflineActionKind, OfflineActionRisk } from "@/lib/offline/types";

export const OFFLINE_ACTION_META: Record<
  OfflineActionKind,
  { risk: OfflineActionRisk; titleTr: string; autoReplay: boolean }
> = {
  wellness_draft: { risk: "safe", titleTr: "Sabah raporu taslağı", autoReplay: true },
  rpe_draft: { risk: "safe", titleTr: "RPE raporu taslağı", autoReplay: true },
  attendance_draft: { risk: "safe", titleTr: "Yoklama taslağı", autoReplay: true },
  field_test_draft: { risk: "requires_confirmation", titleTr: "Saha testi taslağı", autoReplay: false },
  coach_note_draft: { risk: "requires_confirmation", titleTr: "Koç sporcu notu", autoReplay: false },
  finance_note_draft: { risk: "requires_confirmation", titleTr: "Finans notu taslağı", autoReplay: false },
  payment_record_draft: { risk: "blocked", titleTr: "Tahsilat taslağı", autoReplay: false },
  private_lesson_complete_draft: { risk: "blocked", titleTr: "Özel ders tamamlandı", autoReplay: false },
  package_lifecycle_draft: { risk: "blocked", titleTr: "Paket durum değişikliği", autoReplay: false },
};

export function riskForKind(kind: OfflineActionKind): OfflineActionRisk {
  return OFFLINE_ACTION_META[kind].risk;
}

export function defaultTitleForKind(kind: OfflineActionKind): string {
  return OFFLINE_ACTION_META[kind].titleTr;
}

export function canAutoReplayKind(kind: OfflineActionKind): boolean {
  const meta = OFFLINE_ACTION_META[kind];
  return meta.autoReplay && meta.risk === "safe";
}
