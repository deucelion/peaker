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

export interface PrivateLessonPackageDetailSnapshot {
  package: PrivateLessonPackage;
  usageRows: PrivateLessonUsage[];
  paymentRows: PrivateLessonPayment[];
}
