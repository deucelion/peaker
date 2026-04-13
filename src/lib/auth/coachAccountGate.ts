import { getSafeRole } from "@/lib/auth/roleMatrix";
import { isInactiveCoachSession } from "@/lib/coach/lifecycle";

export type CoachAccountAccessResult = { blocked: false } | { blocked: true };

/**
 * Pasif koçların dashboarda erişimini kapatır (org gate ile birlikte proxy’de).
 */
export function evaluateCoachAccountDashboardAccess(profile: {
  role: string | null | undefined;
  is_active: boolean | null | undefined;
}): CoachAccountAccessResult {
  if (!isInactiveCoachSession(profile.role, profile.is_active)) {
    return { blocked: false };
  }
  return { blocked: true };
}

/** API / me-role: coach + pasif mi (JWT profil satırından). */
export function coachAccountBlockedFromProfile(profile: {
  role: string | null | undefined;
  is_active: boolean | null | undefined;
}): boolean {
  return getSafeRole(profile.role) === "coach" && profile.is_active === false;
}
