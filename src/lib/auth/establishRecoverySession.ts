import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { parseAuthHashParams } from "@/lib/auth/parseAuthHashParams";

export type RecoverySessionResult =
  | { ok: true; method: "code" | "hash" | "token_hash" | "existing" }
  | { ok: false; error?: string };

/**
 * Şifre sıfırlama e-postasından gelen PKCE `code`, hash `access_token` veya
 * `token_hash` ile oturumu tarayıcıda kurar.
 */
export async function establishRecoverySession(
  location: Pick<Location, "search" | "hash"> = window.location
): Promise<RecoverySessionResult> {
  const query = new URLSearchParams(location.search);
  const code = query.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return { ok: false, error: error.message };
    return { ok: true, method: "code" };
  }

  const hashParams = parseAuthHashParams(location.hash);
  if (hashParams) {
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    const type = hashParams.get("type");
    if (
      accessToken &&
      refreshToken &&
      (type === "recovery" || type === "signup" || type === "invite" || type === "magiclink")
    ) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) return { ok: false, error: error.message };
      return { ok: true, method: "hash" };
    }
  }

  const tokenHash = query.get("token_hash");
  const otpType = query.get("type");
  if (tokenHash && otpType) {
    const { error } = await supabase.auth.verifyOtp({
      type: otpType as EmailOtpType,
      token_hash: tokenHash,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, method: "token_hash" };
  }

  const { data } = await supabase.auth.getSession();
  if (data.session) {
    return { ok: true, method: "existing" };
  }

  return { ok: false };
}

export function clearAuthParamsFromUrl(pathname?: string) {
  const path = pathname ?? window.location.pathname;
  window.history.replaceState({}, "", path);
}
