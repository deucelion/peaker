/**
 * Bildirim kanonik tip kataloğu (Faz 4.5).
 *
 * Server tarafı her bildirimi yazarken bir `NotificationType` ile yazar.
 * Kullanıcı tercihleri (notification_preferences.muted_types) bu listeye göre
 * filtre uygular. CRITICAL_NOTIFICATION_TYPES içindekiler kullanıcı mute
 * etse bile gönderilir.
 *
 * UI sadeliği için tipler 6 görsel kategoride gruplanır (toggle başına 1 grup).
 */

export type NotificationType =
  | "lesson.created"
  | "lesson.assigned"
  | "lesson.cancelled"
  | "program.published"
  | "payment.received"
  | "payment.scheduled"
  | "payment.overdue"
  | "receivable.due_soon"
  | "receivable.overdue"
  | "private_lesson.created"
  | "private_lesson.updated"
  | "private_lesson.cancelled"
  | "package.created"
  | "package.payment_received"
  | "package.payment_overdue"
  | "wellness.reminder";

/** Kullanıcı mute etse bile mutlaka gönderilen tipler. */
export const CRITICAL_NOTIFICATION_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  "lesson.cancelled",
  "payment.overdue",
  "package.payment_overdue",
  "private_lesson.cancelled",
]);

/** UI'da gösterilen 6 toggle grubu. Her grubun altındaki tipler hep birlikte mute olur. */
export type NotificationCategory =
  | "lesson"
  | "program"
  | "payment"
  | "private_lesson"
  | "package"
  | "wellness";

export const NOTIFICATION_CATEGORY_TYPES: Record<NotificationCategory, ReadonlyArray<NotificationType>> = {
  lesson: ["lesson.created", "lesson.assigned"],
  program: ["program.published"],
  payment: ["payment.received", "payment.scheduled", "receivable.due_soon", "receivable.overdue"],
  private_lesson: ["private_lesson.created", "private_lesson.updated"],
  package: ["package.created", "package.payment_received"],
  wellness: ["wellness.reminder"],
};

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, { title: string; description: string }> = {
  lesson: {
    title: "Grup ders bildirimleri",
    description: "Yeni ders oluşturulduğunda veya derse eklendiğinizde bildirim alın.",
  },
  program: {
    title: "Program yayını",
    description: "Haftalık ders programı yayımlandığında bildirim alın.",
  },
  payment: {
    title: "Ödeme bilgileri",
    description: "Tahsilat kaydı eklendiğinde veya vade hatırlatmalarında bildirim alın.",
  },
  private_lesson: {
    title: "Özel ders oturumları",
    description: "Özel ders oluşturulduğunda veya güncellendiğinde bildirim alın.",
  },
  package: {
    title: "Özel ders paketleri",
    description: "Paket oluşturulduğunda veya paket ödemesi alındığında bildirim alın.",
  },
  wellness: {
    title: "Wellness hatırlatma",
    description: "Sporcular için günlük RPE/Wellness hatırlatma bildirimleri.",
  },
};

/** Bir tipin kullanıcı tercihinde mute olup olmadığına bakar (kritikler her zaman geçer). */
export function isNotificationTypeMuted(
  type: NotificationType | undefined | null,
  mutedTypes: ReadonlyArray<string>
): boolean {
  if (!type) return false;
  if (CRITICAL_NOTIFICATION_TYPES.has(type)) return false;
  return mutedTypes.includes(type);
}

/** Toggle UI durumundan muted_types listesi üretir. */
export function buildMutedTypesFromCategoryToggles(
  enabled: Partial<Record<NotificationCategory, boolean>>
): NotificationType[] {
  const muted: NotificationType[] = [];
  (Object.keys(NOTIFICATION_CATEGORY_TYPES) as NotificationCategory[]).forEach((category) => {
    if (enabled[category] === false) {
      for (const type of NOTIFICATION_CATEGORY_TYPES[category]) muted.push(type);
    }
  });
  return muted;
}

/** muted_types listesinden toggle UI durumunu üretir. */
export function buildCategoryTogglesFromMutedTypes(
  mutedTypes: ReadonlyArray<string>
): Record<NotificationCategory, boolean> {
  const result = {} as Record<NotificationCategory, boolean>;
  (Object.keys(NOTIFICATION_CATEGORY_TYPES) as NotificationCategory[]).forEach((category) => {
    const types = NOTIFICATION_CATEGORY_TYPES[category];
    const allMuted = types.length > 0 && types.every((t) => mutedTypes.includes(t));
    result[category] = !allMuted;
  });
  return result;
}
