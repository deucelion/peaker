import { getSafeRole, type UserRole } from "@/lib/auth/roleMatrix";

export type PasswordAdminActor =
  | { kind: "super_admin"; actorId: string; actorRole: string }
  | { kind: "admin"; actorId: string; actorRole: string; organizationId: string };

export type PasswordResetTarget = {
  id: string;
  role: string;
  organization_id: string | null;
};

const ORG_ADMIN_ALLOWED_TARGETS: UserRole[] = ["coach", "sporcu"];

/** null = izinli; string = hata mesaji */
export function assertAdminCanSetUserPassword(
  actor: PasswordAdminActor,
  target: PasswordResetTarget
): string | null {
  if (actor.actorId === target.id) {
    return "Kendi sifrenizi bu ekrandan degistiremezsiniz. Ayarlar veya sifre sifirlama kullanin.";
  }

  const targetRole = getSafeRole(target.role);
  if (!targetRole) {
    return "Gecersiz hedef kullanici rolu.";
  }

  if (actor.kind === "admin") {
    if (!target.organization_id || target.organization_id !== actor.organizationId) {
      return "Bu kullanici sizin organizasyonunuza ait degil.";
    }
    if (!ORG_ADMIN_ALLOWED_TARGETS.includes(targetRole)) {
      return "Organizasyon admini yalnizca koc ve sporcu sifrelerini degistirebilir.";
    }
    return null;
  }

  if (targetRole === "super_admin") {
    return null;
  }

  if (!target.organization_id) {
    return "Hedef kullanicinin organizasyon bilgisi eksik.";
  }

  return null;
}

export function auditEntityForPasswordReset(targetRole: UserRole): {
  action: "coach.lifecycle.update" | "athlete.lifecycle.update" | "organization.lifecycle.update";
  entityType: "coach" | "athlete" | "organization";
} {
  if (targetRole === "coach") {
    return { action: "coach.lifecycle.update", entityType: "coach" };
  }
  if (targetRole === "sporcu") {
    return { action: "athlete.lifecycle.update", entityType: "athlete" };
  }
  return { action: "organization.lifecycle.update", entityType: "organization" };
}
