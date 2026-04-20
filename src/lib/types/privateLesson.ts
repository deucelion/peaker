export type PrivateLessonPaymentStatus = "unpaid" | "partial" | "paid";

export interface PrivateLessonPackage {
  id: string;
  organizationId: string;
  athleteId: string;
  athleteName: string;
  coachId: string | null;
  coachName: string | null;
  packageType: string;
  packageName: string;
  totalLessons: number;
  usedLessons: number;
  remainingLessons: number;
  totalPrice: number;
  amountPaid: number;
  paymentStatus: PrivateLessonPaymentStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PrivateLessonPayment {
  id: string;
  packageId: string;
  athleteId: string;
  coachId: string | null;
  amount: number;
  paidAt: string;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface PrivateLessonUsage {
  id: string;
  packageId: string;
  athleteId: string;
  coachId: string | null;
  usedAt: string;
  note: string | null;
}

export type PrivateLessonSessionStatus = "planned" | "completed" | "cancelled";

/** Özel ders planı (grup dersi değil); haftalık çizelge için startsAt/endsAt ISO. */
export interface PrivateLessonSessionListItem {
  id: string;
  organizationId: string;
  packageId: string;
  packageName: string | null;
  athleteId: string;
  athleteName: string | null;
  coachId: string;
  coachName: string | null;
  startsAt: string;
  endsAt: string;
  location: string | null;
  note: string | null;
  status: PrivateLessonSessionStatus;
  completedAt: string | null;
  cancelledAt: string | null;
}

export interface PrivateLessonPackageDetailSnapshot {
  package: PrivateLessonPackage;
  usageRows: PrivateLessonUsage[];
  paymentRows: PrivateLessonPayment[];
  /**
   * Açık (`planned`) özel ders oturumu sayısı.
   * Ürün kuralı: planlı dersler yalnızca “Ders yapıldı” ile düşer; bu sayı > 0 iken plansız/geçmiş kayıt UI ve
   * `addPrivateLessonUsage` tarafından engellenir (çift düşüm önlenir).
   */
  plannedPrivateSessionCount: number;
  /** Paket detayında plan sekmesi / sporcu salt okunur için. */
  viewerRole: "admin" | "coach" | "sporcu";
  /** Oturum satırında tamamlama / iptal yetkisi için. */
  viewerId: string;
}
