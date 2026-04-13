"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deactivateCoachAction, reactivateCoachAction } from "@/lib/actions/coachLifecycleActions";

type Props = {
  coachId: string;
  coachName: string;
  isActive: boolean;
};

export default function CoachAccountLifecyclePanel({ coachId, coachName, isActive }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(label: string, action: () => Promise<{ success?: true; error?: string } | { error: string }>) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await action();
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setMessage(`${label} tamamlandi.`);
      router.refresh();
    });
  }

  return (
    <section className="bg-[#121215] border border-white/5 rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 space-y-4 min-w-0 overflow-x-hidden">
      <div className="min-w-0">
        <h3 className="text-base sm:text-lg font-black italic text-white uppercase break-words">Hesap durumu</h3>
        <p className="text-[10px] text-gray-500 font-bold mt-1 uppercase tracking-wide sm:tracking-wider break-words">
          Pasif koç oturum açabilir ancak ders, yoklama ve operasyonel işlem yapamaz. Veriler korunur.
        </p>
      </div>
      {message ? (
        <p className="text-[11px] font-bold text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 break-words">{message}</p>
      ) : null}
      {error ? (
        <p className="text-[11px] font-bold text-red-300/90 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 break-words">{error}</p>
      ) : null}
      <div className="flex flex-col sm:flex-row flex-wrap gap-2 min-w-0">
        {isActive ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (
                !window.confirm(
                  `${coachName} hesabını pasif yapmak istiyor musunuz? Koç panele erişemez (bilgi sayfası hariç).`
                )
              ) {
                return;
              }
              run("Pasife alma", () => deactivateCoachAction(coachId));
            }}
            className="min-h-11 w-full sm:w-auto rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-[10px] font-black uppercase text-amber-200 sm:hover:bg-amber-500/15 disabled:opacity-40 touch-manipulation"
          >
            Hesabi pasife al
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`${coachName} hesabini tekrar aktif yapmak istiyor musunuz?`)) return;
              run("Aktifleştirme", () => reactivateCoachAction(coachId));
            }}
            className="min-h-11 w-full sm:w-auto rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-[10px] font-black uppercase text-emerald-200 sm:hover:bg-emerald-500/15 disabled:opacity-40 touch-manipulation"
          >
            Hesabi aktif et
          </button>
        )}
      </div>
    </section>
  );
}
