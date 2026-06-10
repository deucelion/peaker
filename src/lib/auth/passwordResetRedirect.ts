import { PATHS } from "@/lib/navigation/routeRegistry";

/** Şifre sıfırlama e-postası: PKCE code exchange için /auth/callback üzerinden yönlendir. */
export function buildPasswordResetRedirectUrl(origin: string): string {
  const next = encodeURIComponent(PATHS.passwordReset);
  return `${origin}/auth/callback?next=${next}`;
}
