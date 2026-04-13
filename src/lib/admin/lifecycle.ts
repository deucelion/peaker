import { getSafeRole } from "@/lib/auth/roleMatrix";
import { profileRowIsActive } from "@/lib/coach/lifecycle";

export const ADMIN_ACCOUNT_DISABLED_MESSAGE =
  "Yonetici hesabiniz pasif. Panel ve operasyonel islemler kapali. Destek veya ust yonetici ile iletisime gecin.";

export function isInactiveAdminProfile(role: string | null | undefined, isActive: boolean | null | undefined): boolean {
  return getSafeRole(role) === "admin" && !profileRowIsActive(isActive);
}
