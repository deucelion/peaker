export type PrivateLessonPaymentStatus = "unpaid" | "partial" | "paid";

import type { PackageLifecycleStatus } from "@/lib/privateLessons/packageStatus";

export type PackageFinanceSummary = {
  totalPrice: number;
  amountPaid: number;
  remainingBalance: number;
  paymentCount: number;
  lastPaymentAt: string | null;
  paymentComplete: boolean;
  installmentOverdue: boolean;
  installmentCount: number | null;
  installmentIntervalDays: number | null;
  nextPaymentDueAt: string | null;
};

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
  lifecycleStatus: PackageLifecycleStatus;
  installmentCount: number | null;
  installmentIntervalDays: number | null;
  nextPaymentDueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrivateLessonPackageEventRow {
  id: string;
  packageId: string;
  organizationId: string;
  actorId: string | null;
  eventType: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PrivateLessonPackageUsageLessonRow {
  id: string;
  usedAt: string;
  athleteName: string;
  coachName: string | null;
  lessonTitle: string;
  creditsUsed: number;
  attendanceStatus: string | null;
  source: "usage" | "session";
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
  usageLessonRows: PrivateLessonPackageUsageLessonRow[];
  paymentRows: PrivateLessonPayment[];
  eventRows: PrivateLessonPackageEventRow[];
  financeSummary: PackageFinanceSummary;
  plannedSessionPreview: Array<{ id: string; startsAt: string; status: PrivateLessonSessionStatus }>;
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
