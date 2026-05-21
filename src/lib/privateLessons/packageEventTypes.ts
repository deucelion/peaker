/** Faz 18 — Paket event tipleri (private_lesson_package_events.event_type). */

export const PACKAGE_EVENT_TYPES = [
  "package_created",
  "payment_added",
  "lesson_used",
  "package_paused",
  "package_resumed",
  "package_cancelled",
  "package_refunded",
  "package_updated",
  "finance_note_added",
] as const;

export type PackageEventType = (typeof PACKAGE_EVENT_TYPES)[number];

export const PACKAGE_EVENT_LABEL_TR: Record<PackageEventType, string> = {
  package_created: "Paket oluşturuldu",
  payment_added: "Tahsilat kaydı eklendi",
  lesson_used: "Ders hakkı kullanıldı",
  package_paused: "Paket donduruldu",
  package_resumed: "Paket yeniden aktif",
  package_cancelled: "Paket iptal edildi",
  package_refunded: "Paket iade edildi",
  package_updated: "Paket güncellendi",
  finance_note_added: "Finans notu",
};
