"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase"; 
import { useRouter } from "next/navigation";
import { Lock, Mail, Loader2, KeyRound } from "lucide-react";
import { getDefaultRouteForRole } from "@/lib/auth/roleMatrix";
import { fetchMeRoleClient } from "@/lib/auth/meRoleClient";
import { PATHS } from "@/lib/navigation/routeRegistry";
import Notification from "@/components/Notification";
import { normalizeEmailInput } from "@/lib/email/emailNormalize";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormMessage(null);
    
    const cleanEmail = normalizeEmailInput(email);
    const cleanPassword = password.trim();

    try {
      // 2. ADIM: Supabase Auth Girişi
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error) {
        console.error("Giriş Detay Hatası:", error);
        if (error.message.includes("Email not confirmed")) {
          setFormMessage("Giriş başarısız: lütfen e-posta adresinizi onaylayın.");
        } else if (error.message.includes("Invalid login credentials")) {
          setFormMessage("Giriş başarısız: e-posta veya şifre hatalı.");
        } else {
          setFormMessage("Hata: " + error.message);
        }
        setLoading(false);
        return;
      }

      // 3. ADIM: Tarayıcı oturumu + çerezler hazır olsun (hemen ardından gelen server action bazen 401 verebiliyor).
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) {
        setFormMessage("Oturum yerel olarak kurulamadı. Lütfen tekrar deneyin.");
        setLoading(false);
        return;
      }

      // 4. ADIM: Rol — buildMeRolePayload ile layout/dashboard ile aynı kontrat
      if (data?.user) {
        let me = await fetchMeRoleClient();
        if (!me.ok && me.httpStatus === 401) {
          await new Promise((r) => setTimeout(r, 120));
          me = await fetchMeRoleClient();
        }

        if (me.ok) {
          console.info("[login] session role", { userId: data.user.id, role: me.role });
          router.replace(getDefaultRouteForRole(me.role));
          return;
        }
        if (me.httpStatus === 401) {
          setFormMessage("Oturum dogrulanamadi. Lutfen tekrar deneyin.");
          return;
        }
        if (me.httpStatus === 403) {
          if (me.error === "admin_inactive") {
            router.replace(PATHS.adminAccount);
          } else if (me.error === "coach_inactive") {
            router.replace(PATHS.coachAccount);
          } else if (me.error === "athlete_inactive") {
            router.replace(PATHS.athleteAccount);
          } else if (me.error === "organization_blocked") {
            if (me.gateStatus) {
              router.replace(`${PATHS.orgDurumu}?reason=${encodeURIComponent(me.gateStatus)}`);
            } else {
              router.replace(PATHS.orgDurumu);
            }
          } else {
            router.replace(`${PATHS.orgDurumu}?reason=profile_missing`);
          }
          return;
        }
        router.replace(`${PATHS.orgDurumu}?reason=profile_missing`);
      }

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Bilinmeyen sistem hatası";
      console.error("Beklenmedik hata:", err);
      setFormMessage("Sistem hatasi: " + message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setFormMessage("Lutfen once e-posta adresinizi yazin.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmailInput(email), {
      redirectTo: `${window.location.origin}/sifre-guncelleme`,
    });
    if (error) {
      setFormMessage("Sifre sifirlama baglantisi gonderilemedi: " + error.message);
      return;
    }
    setFormMessage("Sifre sifirlama baglantisi gonderildi. E-postanizi kontrol edin.");
  };

  return (
    <div className="flex min-h-[100dvh] min-w-0 flex-col items-center justify-center overflow-x-hidden overflow-y-auto overscroll-y-contain bg-[#09090b] px-4 pt-[max(1.25rem,env(safe-area-inset-top,0px))] pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] font-sans sm:px-6 sm:py-6">
      <div className="relative my-auto w-full max-w-md min-w-0 space-y-6 overflow-hidden rounded-[2rem] border border-white/5 bg-[#121215] p-6 shadow-2xl sm:space-y-8 sm:rounded-[3rem] sm:p-10">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#7c3aed]/10 blur-[100px] rounded-full" />
        
        <div className="relative z-10 min-w-0 text-center">
          <div className="mb-6 inline-flex h-16 w-16 -rotate-6 transform items-center justify-center rounded-2xl bg-[#7c3aed] font-black text-3xl italic text-white shadow-lg shadow-[#7c3aed]/20">
            P
          </div>
          <h2 className="break-words text-2xl font-black uppercase tracking-tighter text-white italic sm:text-3xl">
            PEAKER<span className="text-[#7c3aed]">.</span> LOGIN
          </h2>
          <p className="mt-2 break-words text-[10px] font-bold uppercase italic tracking-[0.2em] text-gray-500">
            Performance Lab Giriş
          </p>
        </div>

        <form onSubmit={handleLogin} noValidate className="relative z-10 space-y-4">
          <div className="group relative min-w-0">
            <Mail
              className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-gray-500 transition-colors group-focus-within:text-[#7c3aed] sm:left-5"
              size={18}
              aria-hidden
            />
            <input 
              type="email" 
              placeholder="e-posta adresiniz" 
              inputMode="email"
              autoComplete="email"
              className="min-h-12 w-full min-w-0 touch-manipulation rounded-2xl border border-white/5 bg-black py-3.5 pl-12 pr-4 text-base font-bold lowercase italic text-white outline-none transition-all placeholder:opacity-50 focus:border-[#7c3aed]/50 sm:pl-14 sm:text-xs"
              value={email}
              onChange={(e) => setEmail(normalizeEmailInput(e.target.value))}
              // Mobil cihazlarda otomatik düzeltmeleri kapatır:
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              required
            />
          </div>
          <div className="group relative min-w-0">
            <Lock
              className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-gray-500 transition-colors group-focus-within:text-[#7c3aed] sm:left-5"
              size={18}
              aria-hidden
            />
            <input 
              type="password" 
              placeholder="ŞİFRE" 
              autoComplete="current-password"
              className="min-h-12 w-full min-w-0 touch-manipulation rounded-2xl border border-white/5 bg-black py-3.5 pl-12 pr-4 text-base font-bold uppercase italic text-white outline-none transition-all placeholder:opacity-50 focus:border-[#7c3aed]/50 sm:pl-14 sm:text-xs"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="flex min-h-12 w-full touch-manipulation items-center justify-center gap-3 rounded-[2rem] bg-[#7c3aed] px-4 py-3.5 font-black uppercase italic tracking-widest text-white shadow-xl shadow-[#7c3aed]/10 transition-all sm:hover:bg-[#6d28d9] active:scale-[0.98] disabled:opacity-50 sm:min-h-[3.25rem] sm:p-5"
          >
            {loading ? <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden /> : "SİSTEME GİRİŞ YAP"}
          </button>
        </form>
        {formMessage ? (
          <div className="relative z-10 min-w-0 break-words">
            <Notification
              message={formMessage}
              variant={formMessage.toLowerCase().includes("basarisiz") || formMessage.toLowerCase().includes("hata") ? "error" : "info"}
              className="text-center"
            />
          </div>
        ) : null}

        <div className="relative z-10 pt-2 text-center">
          <button 
            type="button"
            onClick={handleForgotPassword}
            className="min-h-11 w-full touch-manipulation text-gray-500 sm:hover:text-[#7c3aed] text-[9px] font-black italic uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 px-2 py-2 group rounded-xl sm:hover:bg-white/[0.03]"
          >
            <KeyRound size={12} className="transition-transform sm:group-hover:rotate-12" aria-hidden /> ŞİFREMİ UNUTTUM / SIFIRLA
          </button>
        </div>

        <div className="pt-6 text-center opacity-30">
          <p className="break-words text-[8px] font-black uppercase italic tracking-widest text-gray-600">
            © 2026 PEAKER PERFORMANCE LAB
          </p>
        </div>
      </div>
    </div>
  );
}