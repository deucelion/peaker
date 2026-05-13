import type { TrainingParticipantRow } from "@/types/domain";

/**
 * Faz 6.1 — Antrenman yönetimi modüllerinin paylaştığı tipler ve saf yardımcılar.
 */

export type TrainingWorkspaceView =
  | "takvim"
  | "ders-listesi"
  | "ders-olustur"
  | "yoklama"
  | "notlar"
  | "paket-listesi"
  | "planlama"
  | "paketler"
  | "kullanim"
  | "tahsilat";

export const VALID_TRAINING_VIEWS: TrainingWorkspaceView[] = [
  "takvim",
  "ders-listesi",
  "ders-olustur",
  "yoklama",
  "notlar",
  "paket-listesi",
  "planlama",
  "paketler",
  "kullanim",
  "tahsilat",
];

export function toAttendanceBadgeLabel(
  status: "registered" | "attended" | "missed" | "cancelled" | null | undefined
) {
  if (status === "attended") return "KATILDI";
  if (status === "missed") return "GELMEDİ";
  if (status === "cancelled") return "İPTAL";
  return "KAYITLI";
}

export function notificationVariantFromMessage(message: string): "success" | "error" {
  const m = message.toLowerCase();
  if (
    m.includes("başarı") ||
    m.includes("basari") ||
    m.includes("güncellendi") ||
    m.includes("guncellendi") ||
    m.includes("başarılı") ||
    m.includes("basarili")
  ) {
    return "success";
  }
  return "error";
}

export function formatTrainingDateTr(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("tr-TR", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}

export function formatTrainingTimeShort(iso: string | null | undefined) {
  if (!iso) return "--:--";
  try {
    return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
}

export function participantInitials(name: string) {
  const clean = name.trim();
  if (!clean) return "SP";
  const parts = clean.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "";
  const second = parts[1]?.[0] || "";
  return `${first}${second}`.toUpperCase() || clean.slice(0, 2).toUpperCase();
}

export function normalizedAttendanceStatus(
  p: TrainingParticipantRow
): "registered" | "attended" | "missed" | "cancelled" {
  return (p.attendance_status ||
    (p.is_present === true ? "attended" : p.is_present === false ? "missed" : "registered")) as
    | "registered"
    | "attended"
    | "missed"
    | "cancelled";
}
