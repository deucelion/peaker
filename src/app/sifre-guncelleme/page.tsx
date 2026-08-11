"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  clearAuthParamsFromUrl,
  establishRecoverySession,
} from "@/lib/auth/establishRecoverySession";
import { useRouter } from "next/navigation";
import { Lock, Loader2, CheckCircle2 } from "lucide-react";
import Notification from "@/components/Notification";

export default function UpdatePasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await establishRecoverySession();
      if (cancelled) return;

      if (result.ok && result.method !== "existing") {
        clearAuthParamsFromUrl();
      }

      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        setSessionReady(!!data.session);
        if (!data.session) {
          const recoveryError = !result.ok ? result.error : undefined;
          setMessage(
            recoveryError ??
              "Oturum bulunamadi. Lutfen e-postanizdaki sifre sifirlama baglantisini tekrar kullanin veya yeni bir baglanti isteyin."
          );
        }
        setCheckingSession(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionReady) {
      setMessage("Oturum bulunamadi. Lutfen sifre sifirlama e-postasindaki baglantiyi kullanin.");
      return;
    }
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      setMessage("Hata: " + error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
    }
  };

  return (
    <div className="flex min-h-[100dvh] min-w-0 items-center justify-center overflow-x-hidden ui-page px-4 py-6 pt-[max(1.5rem,env(safe-area-inset-top,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="w-full max-w-md min-w-0 space-y-6 rounded-[2rem] border border-white/5 ui-card p-5 text-center shadow-2xl sm:space-y-8 sm:rounded-[3rem] sm:p-10">
        {!success ? (
          <>
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl ui-btn-primary font-black text-2xl italic text-white shadow-lg shadow-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_20%,transparent)] sm:mb-6 sm:h-16 sm:w-16 sm:text-3xl">
              P
            </div>
            <h2 className="break-words text-xl font-black uppercase tracking-tighter text-white italic sm:text-3xl">
              YENİ ŞİFRE BELİRLE
            </h2>
            <p className="mb-6 break-words text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 sm:mb-8">
              Hesabını Güvenceye Al
            </p>

            <form onSubmit={handleUpdate} className="space-y-4 text-left sm:text-center">
              <div className="group relative min-w-0">
                <Lock
                  className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-gray-500 group-focus-within:text-[color:var(--peaker-ui-PRIMARY)] sm:left-5"
                  size={18}
                  aria-hidden
                />
                <input
                  type="password"
                  name="new-password"
                  autoComplete="new-password"
                  placeholder="YENİ ŞİFRE"
                  required
                  minLength={6}
                  className="ui-input min-h-11 w-full min-w-0 touch-manipulation"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={loading || checkingSession || !sessionReady}
                className="flex min-h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-[2rem] ui-btn-primary p-4 font-black uppercase italic tracking-widest text-white transition-all sm:hover:bg-[color:var(--peaker-ui-PRIMARY)] disabled:opacity-60 sm:p-5"
              >
                {loading ? <Loader2 className="animate-spin shrink-0" aria-hidden /> : "ŞİFREYİ GÜNCELLE"}
              </button>
            </form>
            {message ? <div className="min-w-0 break-words text-left sm:text-center"><Notification message={message} variant="error" /></div> : null}
          </>
        ) : (
          <div className="space-y-6 py-6 sm:py-10">
            <div className="flex justify-center">
              <CheckCircle2 className="h-14 w-14 text-green-500 sm:h-16 sm:w-16" aria-hidden />
            </div>
            <h2 className="text-xl font-black uppercase text-white italic sm:text-2xl">BAŞARILI!</h2>
            <p className="break-words text-sm font-bold uppercase tracking-widest text-gray-400">
              Şifren güncellendi. Giriş ekranına yönlendiriliyorsun...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}