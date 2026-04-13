import { getSafeRole } from "@/lib/auth/roleMatrix";
import type { CoachAccountLifecycleLabel } from "@/lib/types/coach";

export const COACH_ACCOUNT_DISABLED_MESSAGE =
  "Hesabiniz pasif. Operasyonel islemler kapali. Yonetici ile iletisime gecin.";

/**
 * Profil `is_active` bayragi: null/undefined migration oncesi veya eksik alan → operasyonel kabul (fail-open).
 */
export function profileRowIsActive(isActive: boolean | null | undefined): boolean {
  return isActive !== false;
}

/** Oturum sahibi koç ve pasif mi? */
export function isInactiveCoachSession(role: string | null | undefined, isActive: boolean | null | undefined): boolean {
  return getSafeRole(role) === "coach" && !profileRowIsActive(isActive);
}

/**
 * Server action icin: koç rolundeki aktor pasifse hata mesaji, degilse null.
 */
export function messageIfCoachCannotOperate(role: string | null | undefined, isActive: boolean | null | undefined): string | null {
  if (getSafeRole(role) !== "coach") return null;
  if (!profileRowIsActive(isActive)) return COACH_ACCOUNT_DISABLED_MESSAGE;
  return null;
}

/** Hedef profil koç ve pasif mi (admin baska koç secerken). */
export function isInactiveCoachProfile(
  role: string | null | undefined,
  isActive: boolean | null | undefined
): boolean {
  return getSafeRole(role) === "coach" && !profileRowIsActive(isActive);
}

export function coachLifecycleLabel(isActive: boolean | null | undefined): CoachAccountLifecycleLabel {
  return profileRowIsActive(isActive) ? "active" : "inactive";
}
