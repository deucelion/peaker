"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  clearAuthParamsFromUrl,
  establishRecoverySession,
} from "@/lib/auth/establishRecoverySession";
import { PATHS } from "@/lib/navigation/routeRegistry";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const nextRaw = searchParams.get("next");
      const next =
        nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//")
          ? nextRaw
          : PATHS.passwordReset;

      const result = await establishRecoverySession();
      if (cancelled) return;

      if (result.ok) {
        clearAuthParamsFromUrl();
        router.replace(next);
        return;
      }

      setMessage(
        "Sifre sifirlama baglantisi gecersiz veya suresi dolmus. Giris sayfasina yonlendiriliyorsunuz..."
      );
      router.replace(`${PATHS.login}?error=auth_callback_failed`);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#09090b] px-4 text-center">
      <Loader2 className="h-10 w-10 animate-spin text-[#7c3aed]" aria-hidden />
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
        {message ?? "Oturum dogrulaniyor..."}
      </p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-[#09090b]">
          <Loader2 className="h-10 w-10 animate-spin text-[#7c3aed]" aria-hidden />
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
