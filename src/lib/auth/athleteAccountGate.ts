import { getSafeRole } from "@/lib/auth/roleMatrix";
import { profileRowIsActive } from "@/lib/coach/lifecycle";

export type AthleteAccountAccessResult = { blocked: false } | { blocked: true };

export function evaluateAthleteAccountDashboardAccess(profile: {
  role: string | null | undefined;
  is_active: boolean | null | undefined;
}): AthleteAccountAccessResult {
  if (getSafeRole(profile.role) !== "sporcu") return { blocked: false };
  if (!profileRowIsActive(profile.is_active)) return { blocked: true };
  return { blocked: false };
}

export function athleteAccountBlockedFromProfile(profile: {
  role: string | null | undefined;
  is_active: boolean | null | undefined;
}): boolean {
  return getSafeRole(profile.role) === "sporcu" && profile.is_active === false;
}
