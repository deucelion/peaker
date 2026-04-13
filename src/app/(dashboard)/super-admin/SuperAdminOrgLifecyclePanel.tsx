"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  archiveOrganizationAction,
  reactivateOrganizationAction,
  suspendOrganizationAction,
} from "@/lib/actions/superAdminActions";
import {
  ORGANIZATION_STATUS_LABELS,
  canArchiveOrganizationStatus,
  canReactivateOrganizationStatus,
  canSuspendOrganizationStatus,
  type OrganizationStatus,
} from "@/lib/organization/lifecycle";

type Props = {
  organizationId: string;
  organizationName: string;
  status: OrganizationStatus;
  /** false: DB'de status vb. kolonlar yok; migration uygulanana kadar aksiyonlar kapalı. */
  lifecycleColumnsPresent?: boolean;
};

function statusBadgeClass(s: OrganizationStatus): string {
  switch (s) {
    case "active":
      return "text-emerald-300 border-emerald-500/25 bg-emerald-500/10";
    case "trial":
      return "text-sky-300 border-sky-500/25 bg-sky-500/10";
    case "suspended":
      return "text-amber-300 border-amber-500/25 bg-amber-500/10";
    case "archived":
      return "text-gray-400 border-white/10 bg-white/5";
    case "expired":
      return "text-red-300 border-red-500/25 bg-red-500/10";
    default:
      return "text-gray-300 border-white/10 bg-white/5";
  }
}

export default function SuperAdminOrgLifecyclePanel({
  organizationId,
  organizationName,
  status,
  lifecycleColumnsPresent = true,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState("");

  function run(
    label: string,
    action: () => Promise<{ success?: true; error?: string } | { error: string }>,
    onSuccess?: () => void
  ) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await action();
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setMessage(`${label} tamamlandi.`);
      onSuccess?.();
      router.refresh();
    });
  }

  const archivePhrase = `ARSIVLE ${organizationName}`.toUpperCase();
  const archiveOk = archiveConfirm.trim().toUpperCase() === archivePhrase;

  return (
    <section className="bg-[#121215] border border-white/5 rounded-[1.5rem] p-4 sm:p-5 space-y-4 min-w-0 overflow-x-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between min-w-0">
        <div className="min-w-0 flex-1">
          <p className="text-white text-sm font-black italic uppercase">Organizasyon durumu</p>
          <p className="text-[10px] text-gray-500 font-bold mt-1 uppercase tracking-wide sm:tracking-wider break-words">
            Yalnızca süper admin • Durum değişince tüm org kullanıcıları anında kısıtlanır
          </p>
        </div>
        <span
          className={`shrink-0 self-start px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wide sm:tracking-wider max-w-full break-words ${statusBadgeClass(status)}`}
        >
          {ORGANIZATION_STATUS_LABELS[status]}
        </span>
      </div>

      {message ? (
        <p className="text-[11px] font-bold text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 break-words">{message}</p>
      ) : null}
      {error ? (
        <p className="text-[11px] font-bold text-red-300/90 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 break-words">{error}</p>
      ) : null}

      {!lifecycleColumnsPresent ? (
        <p className="text-[11px] font-bold text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2 leading-relaxed break-words">
          Veritabanında organizasyon lifecycle kolonları (status, starts_at, ends_at, updated_at) henüz yok. Supabase&apos;de{" "}
          <code className="text-[10px] text-amber-100/80">20260403_organization_lifecycle.sql</code> migration&apos;ını uygulayın;
          ardından askıya alma / arşivleme çalışır. Şimdilik detay sayfası eski şema ile okunuyor.
        </p>
      ) : null}

      <div className="flex flex-col sm:flex-row flex-wrap gap-2 min-w-0">
        {lifecycleColumnsPresent && canSuspendOrganizationStatus(status) ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("Organizasyonu askıya almak istediğinize emin misiniz? Tüm kullanıcılar panele erişemez.")) {
                return;
              }
              run("Askıya alma", () => suspendOrganizationAction(organizationId));
            }}
            className="min-h-11 w-full sm:w-auto rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-[10px] font-black uppercase text-amber-200 sm:hover:bg-amber-500/15 disabled:opacity-40 touch-manipulation"
          >
            Askıya al
          </button>
        ) : null}

        {lifecycleColumnsPresent && canReactivateOrganizationStatus(status) ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm("Organizasyonu yeniden aktifleştirmek istediğinize emin misiniz?")) return;
              run("Aktifleştirme", () => reactivateOrganizationAction(organizationId));
            }}
            className="min-h-11 w-full sm:w-auto rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-[10px] font-black uppercase text-emerald-200 sm:hover:bg-emerald-500/15 disabled:opacity-40 touch-manipulation"
          >
            Yeniden aktifleştir
          </button>
        ) : null}

        {lifecycleColumnsPresent && canArchiveOrganizationStatus(status) ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setArchiveOpen(true);
              setArchiveConfirm("");
              setError(null);
            }}
            className="min-h-11 w-full sm:w-auto rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-[10px] font-black uppercase text-red-200 sm:hover:bg-red-500/15 disabled:opacity-40 touch-manipulation"
          >
            Arşivle…
          </button>
        ) : null}
      </div>

      {lifecycleColumnsPresent && archiveOpen ? (
        <div className="rounded-xl border border-red-500/25 bg-black/30 p-3 sm:p-4 space-y-3 min-w-0">
          <p className="text-[11px] font-bold text-gray-300 leading-relaxed break-words">
            Arşivlenen organizasyonda ürün erişimi kapanır. Kurtarmak için &quot;Yeniden aktifleştir&quot; kullanılır (hard delete yok).
          </p>
          <p className="text-[10px] font-black uppercase text-gray-500 break-words">
            Onay için yazın: <span className="text-red-300 break-all">{archivePhrase}</span>
          </p>
          <input
            value={archiveConfirm}
            onChange={(e) => setArchiveConfirm(e.target.value)}
            className="w-full min-w-0 min-h-11 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-base sm:text-xs text-white placeholder:text-gray-600 touch-manipulation"
            placeholder={archivePhrase}
            autoComplete="off"
          />
          <div className="flex flex-col sm:flex-row flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !archiveOk}
              onClick={() =>
                run("Arşivleme", () => archiveOrganizationAction(organizationId), () => setArchiveOpen(false))
              }
              className="min-h-11 w-full sm:w-auto rounded-lg border border-red-500/40 bg-red-500/15 px-4 py-2 text-[10px] font-black uppercase text-red-100 disabled:opacity-30 touch-manipulation"
            >
              Arşivlemeyi onayla
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setArchiveOpen(false)}
              className="min-h-11 w-full sm:w-auto rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase text-gray-300 touch-manipulation"
            >
              Vazgeç
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
