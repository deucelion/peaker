import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PATHS } from "@/lib/navigation/routeRegistry";

/**
 * Supabase PKCE / recovery akışı: e-postadaki link `?code=` ile buraya düşer;
 * oturum çerezlerine yazılır ve kullanıcı hedef sayfaya yönlendirilir.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextRaw = searchParams.get("next");
  const next =
    nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : PATHS.passwordReset;

  if (!code) {
    return NextResponse.redirect(`${origin}${PATHS.login}?error=auth_callback_missing_code`);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}${PATHS.login}?error=${encodeURIComponent("auth_callback_exchange_failed")}`
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
