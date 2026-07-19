import type { CoachPermissions } from "@/lib/types";
import type { WeeklyLessonScheduleItem } from "@/lib/types";
import {
  packageAllowsUsage,
  resolvePackageLifecycleStatus,
  type PackageLifecycleStatus,
} from "@/lib/privateLessons/packageStatus";

/** Admin veya not/program yönetimi yetkili koç org genelinde oturum yönetebilir. */
export function coachMayManagePrivateLessonSession(
  role: string,
  permissions: CoachPermissions | null | undefined,
  sessionCoachId: string | null | undefined,
  actorId: string
): boolean {
  if (role === "admin") return true;
  if (!sessionCoachId || sessionCoachId === actorId) return true;
  return Boolean(permissions?.can_manage_training_notes);
}

export type PrivateLessonCompleteBlockReason =
  | "not_private"
  | "cancelled"
  | "completed"
  | "package_paused"
  | "package_cancelled"
  | "package_refunded"
  | "package_completed"
  | "no_remaining"
  | "not_planned";

export type WeeklyPrivateCompleteUi = {
  showButton: boolean;
  canSubmit: boolean;
  showCompletedBadge: boolean;
  disabledReason: string | null;
  blockReason: PrivateLessonCompleteBlockReason | null;
};

function lifecycleBlockMessage(status: PackageLifecycleStatus): string | null {
  if (status === "paused") return "Paket dondurulmuş; ders tamamlanamaz.";
  if (status === "cancelled") return "Paket iptal edilmiş; ders tamamlanamaz.";
  if (status === "refunded") return "Paket iade edilmiş; ders tamamlanamaz.";
  if (status === "completed") return "Paket tamamlanmış; ders tamamlanamaz.";
  return null;
}

export function resolveWeeklyPrivateCompleteUi(
  item: WeeklyLessonScheduleItem
): WeeklyPrivateCompleteUi {
  if (item.sourceType !== "private") {
    return {
      showButton: false,
      canSubmit: false,
      showCompletedBadge: false,
      disabledReason: null,
      blockReason: "not_private",
    };
  }

  const status = (item.status || "planned").toLowerCase();
  if (status === "cancelled") {
    return {
      showButton: false,
      canSubmit: false,
      showCompletedBadge: false,
      disabledReason: null,
      blockReason: "cancelled",
    };
  }

  if (status === "completed") {
    return {
      showButton: false,
      canSubmit: false,
      showCompletedBadge: true,
      disabledReason: null,
      blockReason: "completed",
    };
  }

  if (status !== "planned") {
    return {
      showButton: false,
      canSubmit: false,
      showCompletedBadge: false,
      disabledReason: "Yalnızca planlanmış oturum tamamlanabilir.",
      blockReason: "not_planned",
    };
  }

  const lifecycle = item.packageLifecycleStatus
    ? (item.packageLifecycleStatus as PackageLifecycleStatus)
    : resolvePackageLifecycleStatus({
        lifecycleStatus: item.packageLifecycleStatus,
        isActive: item.packageIsActive ?? true,
        remainingLessons: item.packageRemainingLessons ?? 0,
        totalLessons: item.packageTotalLessons ?? 0,
        usedLessons: item.packageUsedLessons ?? 0,
      });

  const lifecycleMsg = lifecycleBlockMessage(lifecycle);
  if (lifecycleMsg || !packageAllowsUsage(lifecycle)) {
    return {
      showButton: true,
      canSubmit: false,
      showCompletedBadge: false,
      disabledReason: lifecycleMsg || "Bu paket durumunda ders tamamlanamaz.",
      blockReason:
        lifecycle === "paused"
          ? "package_paused"
          : lifecycle === "cancelled"
            ? "package_cancelled"
            : lifecycle === "refunded"
              ? "package_refunded"
              : "package_completed",
    };
  }

  const remaining = item.packageRemainingLessons ?? 0;
  if (remaining <= 0) {
    return {
      showButton: true,
      canSubmit: false,
      showCompletedBadge: false,
      disabledReason: "Pakette kullanılacak ders kalmadı.",
      blockReason: "no_remaining",
    };
  }

  return {
    showButton: true,
    canSubmit: true,
    showCompletedBadge: false,
    disabledReason: null,
    blockReason: null,
  };
}

export function mapRpcCompleteErrorToUserMessage(rpcError: string | undefined): string {
  const raw = (rpcError || "").trim();
  if (!raw) return "Ders tamamlanamadı.";
  if (raw.includes("zaten işlenmiş") || raw.includes("zaten tamamlan")) {
    return "Bu ders zaten yapıldı olarak işaretlenmiş.";
  }
  if (raw.includes("Pasif paket")) return "Paket aktif değil; ders tamamlanamaz.";
  if (raw.includes("kullanılacak ders kalmadı")) return "Pakette kullanılacak ders kalmadı.";
  if (raw.includes("Yalnızca planlanmış")) return "Yalnızca planlanmış oturum tamamlanabilir.";
  if (raw.includes("iptal")) return "İptal edilmiş oturum tamamlanamaz.";
  return raw;
}
