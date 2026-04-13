import { getSafeRole } from "@/lib/auth/roleMatrix";
import { profileRowIsActive } from "@/lib/coach/lifecycle";

export const ATHLETE_ACCOUNT_DISABLED_MESSAGE =
  "Hesabiniz pasif. Panel kullanimi kapali. Yonetici veya antrenor ile iletisime gecin.";

export function messageIfAthleteCannotOperate(
  role: string | null | undefined,
  isActive: boolean | null | undefined
): string | null {
  if (getSafeRole(role) !== "sporcu") return null;
  if (!profileRowIsActive(isActive)) return ATHLETE_ACCOUNT_DISABLED_MESSAGE;
  return null;
}

export function isInactiveAthleteProfile(
  role: string | null | undefined,
  isActive: boolean | null | undefined
): boolean {
  return getSafeRole(role) === "sporcu" && !profileRowIsActive(isActive);
}
