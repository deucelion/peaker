import { PATHS } from "@/lib/navigation/routeRegistry";

/** Şifre sıfırlama e-postası: doğrudan şifre güncelleme sayfasına (PKCE code client-side). */
export function buildPasswordResetRedirectUrl(origin: string): string {
  return `${origin}${PATHS.passwordReset}`;
}
