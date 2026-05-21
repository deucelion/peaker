import type { PrivateLessonPackage } from "@/lib/types";

export type PackageLifecycleStatus = "active" | "paused" | "completed" | "cancelled" | "refunded";

export const PACKAGE_LIFECYCLE_LABEL: Record<PackageLifecycleStatus, string> = {
  active: "Aktif",
  paused: "Donduruldu",
  completed: "Tamamlandı",
  cancelled: "İptal Edildi",
  refunded: "İade Edildi",
};

export const PACKAGE_LIFECYCLE_TONE: Record<PackageLifecycleStatus, string> = {
  active: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
  paused: "text-amber-300 border-amber-500/30 bg-amber-500/10",
  completed: "text-sky-300 border-sky-500/30 bg-sky-500/10",
  cancelled: "text-gray-400 border-white/10 bg-white/5",
  refunded: "text-rose-300 border-rose-500/30 bg-rose-500/10",
};

const STORED_STATUSES = new Set<string>(["active", "paused", "completed", "cancelled", "refunded"]);

/** DB kolonu yokken veya eski satırlar için türetme. */
export function derivePackageLifecycleStatus(pkg: {
  isActive: boolean;
  remainingLessons: number;
  totalLessons: number;
  usedLessons: number;
}): PackageLifecycleStatus {
  if (pkg.isActive) {
    if (pkg.remainingLessons <= 0 && pkg.usedLessons > 0) return "completed";
    return "active";
  }
  if (pkg.remainingLessons <= 0 && pkg.usedLessons >= pkg.totalLessons && pkg.totalLessons > 0) {
    return "completed";
  }
  if (pkg.remainingLessons > 0) return "paused";
  return "cancelled";
}

export function resolvePackageLifecycleStatus(pkg: {
  lifecycleStatus?: string | null;
  isActive: boolean;
  remainingLessons: number;
  totalLessons: number;
  usedLessons: number;
}): PackageLifecycleStatus {
  const stored = pkg.lifecycleStatus?.trim();
  if (stored && STORED_STATUSES.has(stored)) {
    return stored as PackageLifecycleStatus;
  }
  return derivePackageLifecycleStatus(pkg);
}

export function packageAllowsNewSessions(status: PackageLifecycleStatus): boolean {
  return status === "active";
}

export function packageAllowsPayment(status: PackageLifecycleStatus): boolean {
  return status === "active" || status === "paused";
}

export function packageAllowsUsage(status: PackageLifecycleStatus): boolean {
  return status === "active";
}

export function canFreezePackage(status: PackageLifecycleStatus): boolean {
  return status === "active";
}

export function canResumePackage(status: PackageLifecycleStatus): boolean {
  return status === "paused";
}

export function canCancelPackage(status: PackageLifecycleStatus): boolean {
  return status === "active" || status === "paused";
}

export function canRefundPackage(status: PackageLifecycleStatus): boolean {
  return status === "active" || status === "paused" || status === "completed" || status === "cancelled";
}

export function lifecycleLabelForPackage(pkg: PrivateLessonPackage): string {
  return PACKAGE_LIFECYCLE_LABEL[resolvePackageLifecycleStatus(pkg)];
}
