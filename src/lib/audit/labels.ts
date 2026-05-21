import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, type AuditAction, type AuditEntityType } from "@/lib/audit/types";

/**
 * Audit log UI yardımcıları (Faz 3.4):
 * - action / entity_type için kullanıcı dostu Türkçe etiket
 * - sade rozet için alt kategori (lifecycle, payment, lesson, permission)
 * - metadata anahtarları için Türkçe karşılıkları
 */

const ACTION_LABEL_TR: Record<AuditAction, string> = {
  "lesson.create": "Ders oluşturuldu",
  "lesson.update": "Ders güncellendi",
  "lesson.cancel": "Ders iptal edildi",
  "lesson.participant.add": "Derse katılımcı eklendi",
  "lesson.participant.remove": "Dersten katılımcı çıkarıldı",
  "attendance.status.update": "Yoklama güncellendi",
  "program.create": "Program oluşturuldu",
  "program.update": "Program güncellendi",
  "payment.create": "Tahsilat kaydı oluşturuldu",
  "payment.status.update": "Tahsilat durumu değişti",
  "payment.record.cancel": "Tahsilat kaydı iptal edildi",
  "payment.record.correct": "Tahsilat kaydı düzeltildi",
  "private_lesson_ledger.void": "Paket tahsilat defteri iptal edildi",
  "finance_note.create": "Finans notu eklendi",
  "finance_note.delete": "Finans notu silindi",
  "private_lesson_package.create": "Özel ders paketi oluşturuldu",
  "private_lesson_package.update": "Özel ders paketi güncellendi",
  "private_lesson_package.freeze": "Özel ders paketi donduruldu",
  "private_lesson_package.resume": "Özel ders paketi yeniden aktif",
  "private_lesson_package.cancel": "Özel ders paketi iptal edildi",
  "private_lesson_package.refund": "Özel ders paketi iade edildi",
  "private_lesson_package.lesson_used": "Özel ders paketinden ders kullanıldı",
  "private_lesson_session.complete": "Özel ders oturumu tamamlandı",
  "permission.coach.update": "Koç izinleri güncellendi",
  "permission.athlete.update": "Sporcu izinleri güncellendi",
  "coach.lifecycle.update": "Koç yaşam döngüsü güncellendi",
  "athlete.lifecycle.update": "Sporcu yaşam döngüsü güncellendi",
  "organization.lifecycle.update": "Organizasyon yaşam döngüsü güncellendi",
  "organization.license.update": "Organizasyon lisansı güncellendi",
  "organization.create": "Organizasyon oluşturuldu",
  "job.queue.retry_single": "Async job tekrar kuyruğa alındı",
  "job.queue.retry_all": "Async job toplu retry",
  "job.queue.dlq_requeue": "DLQ job ana kuyruğa alındı",
  "job.queue.cancel": "Async job iptal edildi",
  "job.queue.purge_completed": "Tamamlanan async job kayıtları temizlendi",
  "operational.alert.acknowledge": "Operasyonel uyarı onaylandı",
  "operational.alert.resolve": "Operasyonel uyarı çözümlendi",
  "operational.replay.evaluate_alerts": "Uyarı değerlendirmesi yenilendi (replay)",
  "operational.replay.export_audit": "Audit export job tekrar kuyruğa alındı",
  "operational.replay.retention_audit": "Audit retention job tetiklendi (replay)",
};

const ENTITY_LABEL_TR: Record<AuditEntityType, string> = {
  lesson: "Ders",
  training_participant: "Katılımcı",
  attendance: "Yoklama",
  program: "Program",
  payment: "Ödeme",
  finance_contact_note: "Finans notu",
  private_lesson_package: "Özel ders paketi",
  private_lesson_session: "Özel ders oturumu",
  coach_permission: "Koç izni",
  athlete_permission: "Sporcu izni",
  coach: "Koç",
  athlete: "Sporcu",
  organization: "Organizasyon",
  async_job: "Async iş",
};

export function actionLabel(action: string): string {
  return ACTION_LABEL_TR[action as AuditAction] ?? action;
}

export function entityLabel(entity: string): string {
  return ENTITY_LABEL_TR[entity as AuditEntityType] ?? entity;
}

/**
 * Aksiyona göre rozet rengini sınıflandır:
 * - destructive → kırmızı (cancel, lifecycle deactivate)
 * - mutation    → mor (default - update/status)
 * - creation    → yeşil (create/add)
 * - permission  → amber (permission değişiklikleri)
 */
export function actionTone(action: string): "destructive" | "mutation" | "creation" | "permission" {
  if (action.includes(".cancel") || action.includes(".remove")) return "destructive";
  if (action.startsWith("operational.")) return "mutation";
  if (action.startsWith("permission.")) return "permission";
  if (action.endsWith(".create") || action.endsWith(".add")) return "creation";
  return "mutation";
}

const TONE_STYLES: Record<ReturnType<typeof actionTone>, string> = {
  destructive: "border-red-500/30 bg-red-500/10 text-red-200",
  mutation: "border-[#7c3aed]/30 bg-[#7c3aed]/10 text-[#c4b5fd]",
  creation: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  permission: "border-amber-500/30 bg-amber-500/10 text-amber-200",
};

export function actionToneClass(action: string): string {
  return TONE_STYLES[actionTone(action)];
}

const METADATA_LABEL_TR: Record<string, string> = {
  amount: "Tutar",
  currency: "Para birimi",
  status: "Durum",
  previous_status: "Önceki durum",
  next_status: "Yeni durum",
  paid_at: "Ödeme tarihi",
  due_date: "Son ödeme",
  payment_type: "Ödeme tipi",
  payment_kind: "Ödeme kategorisi",
  scope: "Kapsam",
  reason: "Sebep",
  note: "Not",
  changes: "Değişiklikler",
  package_id: "Paket",
  package_name: "Paket adı",
  total_lessons: "Toplam ders",
  remaining_lessons: "Kalan ders",
  lesson_id: "Ders",
  attendance_status: "Yoklama durumu",
  permission_key: "İzin anahtarı",
  permission_value: "İzin değeri",
  is_active: "Aktif mi?",
  start_time: "Başlangıç",
  end_time: "Bitiş",
  organization_id: "Organizasyon",
  athlete_id: "Sporcu",
  coach_id: "Koç",
  email: "E-posta",
  full_name: "Ad soyad",
  team: "Takım",
};

/** Metadata anahtarına Türkçe karşılığını verir; bilinmiyorsa anahtarı insan-okur format döner. */
export function metadataLabel(key: string): string {
  if (METADATA_LABEL_TR[key]) return METADATA_LABEL_TR[key];
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Metadata değerini insan-okur string'e çevir.
 * - boolean → "Evet" / "Hayır"
 * - null/undefined → "—"
 * - string/number → string
 * - object/array → JSON tek satır (drawer'da pre-format kullanır)
 */
export function metadataValueToString(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  if (typeof value === "number" || typeof value === "string") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Drawer için top-level entries (key, label, value, isComplex). */
export function metadataEntries(meta: Record<string, unknown>): Array<{
  key: string;
  label: string;
  value: unknown;
  /** object/array ise true (drawer içinde pre block'la göster) */
  isComplex: boolean;
}> {
  return Object.entries(meta).map(([key, value]) => ({
    key,
    label: metadataLabel(key),
    value,
    isComplex: !!value && typeof value === "object",
  }));
}

export const ALL_AUDIT_ACTIONS = AUDIT_ACTIONS;
export const ALL_AUDIT_ENTITIES = AUDIT_ENTITY_TYPES;
