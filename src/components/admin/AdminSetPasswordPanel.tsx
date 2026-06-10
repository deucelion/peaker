"use client";

import { useEffect, useState, useTransition } from "react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { setUserPasswordByAdmin } from "@/lib/actions/adminPasswordActions";
import { fetchMeRoleClient } from "@/lib/auth/meRoleClient";
import { PASSWORD_FIELD_PROPS } from "@/lib/auth/passwordInput";

type Props = {
  targetUserId: string;
  targetName: string;
  /** Orn. Koç, Sporcu, Org Admin */
  targetRoleLabel?: string;
  className?: string;
  /** Super admin sayfasi gibi zaten yetki dogrulanmis baglamlar */
  assumeCanManage?: boolean;
};

export function AdminSetPasswordPanel({
  targetUserId,
  targetName,
  targetRoleLabel,
  className = "",
  assumeCanManage = false,
}: Props) {
  const [canManage, setCanManage] = useState<boolean | null>(assumeCanManage ? true : null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (assumeCanManage) return;
    let cancelled = false;
    void (async () => {
      const res = await fetchMeRoleClient();
      if (cancelled) return;
      setCanManage(res.ok && (res.role === "admin" || res.role === "super_admin"));
    })();
    return () => {
      cancelled = true;
    };
  }, [assumeCanManage]);

  if (canManage === false || canManage === null) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalıdır.");
      return;
    }
    if (
      !window.confirm(
        `${targetName} için yeni şifre atanacak. Eski şifre geçersiz olur. Devam edilsin mi?`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await setUserPasswordByAdmin(targetUserId, password);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setPassword("");
      setMessage("Yeni şifre atandı. Kullanıcıya güvenli kanaldan iletin.");
    });
  }

  return (
    <section
      className={`bg-[#121215] border border-white/5 rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 space-y-4 min-w-0 overflow-x-hidden ${className}`}
    >
      <div className="min-w-0">
        <h3 className="text-base sm:text-lg font-black italic text-white uppercase break-words flex items-center gap-2">
          <KeyRound size={18} className="shrink-0 text-[#7c3aed]" aria-hidden />
          Şifre atama
        </h3>
        <p className="text-[10px] text-gray-500 font-bold mt-1 uppercase tracking-wide sm:tracking-wider break-words">
          {targetRoleLabel ? `${targetRoleLabel} · ` : ""}
          {targetName} — doğrudan yeni şifre belirlenir (e-posta gönderilmez).
        </p>
      </div>
      {message ? (
        <p className="text-[11px] font-bold text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 break-words">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-[11px] font-bold text-red-300/90 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 break-words">
          {error}
        </p>
      ) : null}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 min-w-0">
        <div className="relative min-w-0 flex-1">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            autoComplete="new-password"
            placeholder="Yeni şifre (min 6 karakter)"
            className="ui-input min-h-11 w-full bg-black/40 pr-11 normal-case"
            disabled={pending}
            {...PASSWORD_FIELD_PROPS}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 sm:hover:text-gray-300"
            aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
          >
            {showPassword ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
          </button>
        </div>
        <button
          type="submit"
          disabled={pending || password.length < 6}
          className="min-h-11 shrink-0 rounded-xl border border-[#7c3aed]/35 bg-[#7c3aed]/15 px-4 py-2.5 text-[10px] font-black uppercase text-[#ddd6fe] sm:hover:bg-[#7c3aed]/25 disabled:opacity-40 touch-manipulation inline-flex items-center justify-center gap-2"
        >
          {pending ? <Loader2 className="animate-spin" size={14} aria-hidden /> : null}
          Şifreyi kaydet
        </button>
      </form>
    </section>
  );
}
