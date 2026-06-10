"use client";

import { useEffect } from "react";
import { PATHS } from "@/lib/navigation/routeRegistry";
import { parseAuthHashParams } from "@/lib/auth/parseAuthHashParams";

/**
 * Supabase bazen Site URL'e (#access_token ile) düşürür; hash sunucuya gitmez.
 * Recovery hash'i yakalayıp şifre güncelleme sayfasına taşır.
 */
export function AuthRecoveryRedirect() {
  useEffect(() => {
    const hashParams = parseAuthHashParams(window.location.hash);
    if (!hashParams) return;

    const type = hashParams.get("type");
    const accessToken = hashParams.get("access_token");
    if (type !== "recovery" || !accessToken) return;

    const pathname = window.location.pathname;
    if (pathname === PATHS.passwordReset || pathname === "/auth/callback") return;

    window.location.replace(
      `${PATHS.passwordReset}${window.location.search}${window.location.hash}`
    );
  }, []);

  return null;
}
