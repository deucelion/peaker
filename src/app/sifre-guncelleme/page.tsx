"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Lock, Loader2, CheckCircle2 } from "lucide-react";
import Notification from "@/components/Notification";

export default function UpdatePasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <div className="flex min-h-[100dvh] min-w-0 items-center justify-center overflow-x-hidden bg-[#09090b] px-4 py-6 pt-[max(1.5rem,env(safe-area-inset-top,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="w-full max-w-md min-w-0 space-y-6 rounded-[2rem] border border-white/5 bg-[#121215] p-5 text-center shadow-2xl sm:space-y-8 sm:rounded-[3rem] sm:p-10">
        {!success ? (
          <>
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#7c3aed] font-black text-2xl italic text-white shadow-lg shadow-[#7c3aed]/20 sm:mb-6 sm:h-16 sm:w-16 sm:text-3xl">
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
                  className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-gray-500 group-focus-within:text-[#7c3aed] sm:left-5"
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
                  className="min-h-11 w-full min-w-0 touch-manipulation rounded-2xl border border-white/5 bg-black py-3.5 pl-12 pr-4 text-base font-bold uppercase italic text-white outline-none focus:border-[#7c3aed]/50 sm:py-5 sm:pl-14 sm:text-xs"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex min-h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-[2rem] bg-[#7c3aed] p-4 font-black uppercase italic tracking-widest text-white transition-all sm:hover:bg-[#6d28d9] disabled:opacity-60 sm:p-5"
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