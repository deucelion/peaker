"use client";

import { useEffect, useState, useTransition } from "react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { setUserPasswordByAdmin } from "@/lib/actions/adminPasswordActions";
import { fetchMeRoleClient } from "@/lib/auth/meRoleClient";
import { PASSWORD_FIELD_PROPS } from "@/lib/auth/passwordInput";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";

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
      className={`${uiBrandingClasses.card.base} space-y-4 min-w-0 overflow-x-hidden rounded-[1.5rem] p-4 sm:rounded-[2rem] sm:p-6 ${className}`}
    >
      <div className="min-w-0">
        <h3 className="flex items-center gap-2 break-words text-base font-black uppercase italic text-white sm:text-lg">
          <KeyRound
            size={18}
            className="shrink-0 text-[color:var(--peaker-ui-PRIMARY)]"
            aria-hidden
          />
          Şifre atama
        </h3>
        <p className="mt-1 break-words text-[10px] font-bold uppercase tracking-wide text-gray-500 sm:tracking-wider">
          {targetRoleLabel ? `${targetRoleLabel} · ` : ""}
          {targetName} — doğrudan yeni şifre belirlenir (e-posta gönderilmez).
        </p>
      </div>
      {message ? (
        <p className="break-words rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-400/90">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="break-words rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] font-bold text-red-300/90">
          {error}
        </p>
      ) : null}
      <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            autoComplete="new-password"
            placeholder="Yeni şifre (min 6 karakter)"
            className={`${uiBrandingClasses.form.input} min-h-11 w-full pr-11 normal-case`}
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
          className={`${uiBrandingClasses.kpi.chipBrand} ${uiBrandingClasses.button.base} min-h-11 shrink-0 touch-manipulation disabled:opacity-40`}
        >
          {pending ? <Loader2 className="animate-spin" size={14} aria-hidden /> : null}
          Şifreyi kaydet
        </button>
      </form>
    </section>
  );
}
