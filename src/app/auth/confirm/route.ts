import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PATHS } from "@/lib/navigation/routeRegistry";

/**
 * Supabase e-posta şablonları `token_hash` + `type` kullanıyorsa (SSR recovery)
 * oturumu burada doğrular ve `next` parametresine yönlendirir.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextRaw = searchParams.get("next");
  const next =
    nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : PATHS.passwordReset;

  if (!tokenHash || !type) {
    return NextResponse.redirect(`${origin}${PATHS.login}?error=auth_confirm_missing_params`);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    return NextResponse.redirect(
      `${origin}${PATHS.login}?error=${encodeURIComponent("auth_confirm_verify_failed")}`
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
