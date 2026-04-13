"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { updateOrganizationDisplayNameAction } from "@/lib/actions/organizationProfileActions";
import {
  superAdminSetOrganizationStatusAction,
  updateOrganizationLicenseDatesAction,
} from "@/lib/actions/superAdminActions";
import {
  SUPER_ADMIN_LICENSE_SIGNAL_LABELS,
  superAdminLicenseSignal,
  type SuperAdminLicenseSignal,
} from "@/lib/organization/license";
import {
  ORGANIZATION_STATUSES,
  ORGANIZATION_STATUS_LABELS,
  type OrganizationStatus,
} from "@/lib/organization/lifecycle";

type Props = {
  organizationId: string;
  organizationName: string;
  status: OrganizationStatus;
  startsAt: string | null;
  endsAt: string | null;
  lifecycleColumnsPresent: boolean;
};

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function licenseSignalChipClass(signal: SuperAdminLicenseSignal): string {
  switch (signal.kind) {
    case "expired_by_date":
    case "pending_start":
      return "text-red-200 border-red-500/30 bg-red-500/10";
    case "expiring_soon":
      return "text-amber-200 border-amber-500/30 bg-amber-500/10";
    case "no_dates":
      return "text-sky-200 border-sky-500/25 bg-sky-500/10";
    default:
      return "text-emerald-200/80 border-emerald-500/20 bg-emerald-500/10";
  }
}

export default function SuperAdminLicensePanel({
  organizationId,
  organizationName,
  status,
  startsAt,
  endsAt,
  lifecycleColumnsPresent,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState(organizationName);
  const [namePending, setNamePending] = useState(false);

  const [startInput, setStartInput] = useState(() => toDatetimeLocalValue(startsAt));
  const [endInput, setEndInput] = useState(() => toDatetimeLocalValue(endsAt));
  const [statusSelect, setStatusSelect] = useState<OrganizationStatus>(status);

  useEffect(() => {
    const id = setTimeout(() => {
      setStartInput(toDatetimeLocalValue(startsAt));
      setEndInput(toDatetimeLocalValue(endsAt));
      setStatusSelect(status);
      setNameInput(organizationName);
    }, 0);
    return () => clearTimeout(id);
  }, [startsAt, endsAt, status, organizationName]);

  const signal = superAdminLicenseSignal(status, startsAt, endsAt);
  const signalLabel = SUPER_ADMIN_LICENSE_SIGNAL_LABELS[signal.kind];
  const signalDetail =
    signal.kind === "expiring_soon" ? ` (${signal.daysLeft} gun kaldi)` : signal.kind === "no_dates" ? "" : "";

  function isoOrNullFromLocal(v: string): string | null {
    const t = v.trim();
    if (!t) return null;
    const ms = new Date(t).getTime();
    if (Number.isNaN(ms)) return null;
    return new Date(ms).toISOString();
  }

  return (
    <section className="bg-[#121215] border border-white/5 rounded-[1.5rem] p-4 sm:p-5 space-y-4 sm:space-y-5 min-w-0 overflow-x-hidden">
      <div className="rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4 space-y-3 min-w-0">
        <p className="text-white text-xs font-black italic uppercase break-words">Organizasyon adi (marka / gorunen isim)</p>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-stretch min-w-0">
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            minLength={2}
            maxLength={120}
            className="min-w-0 flex-1 min-h-11 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-base sm:text-sm text-white touch-manipulation"
          />
          <button
            type="button"
            disabled={namePending || nameInput.trim() === organizationName.trim()}
            onClick={() => {
              setError(null);
              setMessage(null);
              setNamePending(true);
              void (async () => {
                const res = await updateOrganizationDisplayNameAction(organizationId, nameInput);
                if (res && "error" in res && res.error) setError(res.error);
                else {
                  setMessage("Organizasyon adi guncellendi.");
                  router.refresh();
                }
                setNamePending(false);
              })();
            }}
            className="min-h-11 w-full shrink-0 rounded-lg border border-[#7c3aed]/40 bg-[#7c3aed]/20 px-4 py-2 text-[10px] font-black uppercase text-[#e9d5ff] disabled:opacity-40 touch-manipulation sm:w-auto sm:self-center"
          >
            {namePending ? "..." : "Adi kaydet"}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between min-w-0">
        <div className="min-w-0 flex-1">
          <p className="text-white text-sm font-black italic uppercase">Lisans ve abonelik</p>
          <p className="text-[10px] text-gray-500 font-bold mt-1 uppercase tracking-wide sm:tracking-wider max-w-xl leading-relaxed break-words">
            <code className="text-[9px] text-gray-400">starts_at</code> / <code className="text-[9px] text-gray-400">ends_at</code>{" "}
            lisans penceresidir. Statü (aktif, deneme, süresi doldu vb.) ticari ve operasyonel durumu gösterir; arşiv veya askı
            her zaman panele erişimi kapatır.
          </p>
        </div>
        {signalLabel ? (
          <span
            className={`shrink-0 max-w-full px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-wide sm:tracking-wider break-words ${licenseSignalChipClass(signal)}`}
          >
            {signalLabel}
            {signalDetail}
          </span>
        ) : (
          <span className="shrink-0 max-w-full px-3 py-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-[10px] font-black uppercase text-emerald-200/90 break-words">
            Lisans penceresi uygun
          </span>
        )}
      </div>

      {message ? (
        <p className="text-[11px] font-bold text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 break-words">{message}</p>
      ) : null}
      {error ? (
        <p className="text-[11px] font-bold text-red-300/90 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 break-words">{error}</p>
      ) : null}

      {!lifecycleColumnsPresent ? (
        <p className="text-[11px] font-bold text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2 break-words">
          Lifecycle kolonlari yok; lisans alanlari migration sonrasi kullanilabilir.
        </p>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-4 min-w-0 [&_input[type=datetime-local]]:min-h-11 [&_input[type=datetime-local]]:w-full [&_input[type=datetime-local]]:max-w-full [&_input[type=datetime-local]]:text-base [&_input[type=datetime-local]]:sm:text-xs">
            <label className="grid gap-1.5 min-w-0">
              <span className="text-[10px] font-black uppercase text-gray-500">Lisans baslangici</span>
              <input
                type="datetime-local"
                value={startInput}
                onChange={(e) => setStartInput(e.target.value)}
                className="min-w-0 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white touch-manipulation"
              />
              <span className="text-[9px] text-gray-600 font-bold break-words">Bos birakirsaniz veritabaninda baslangic temizlenir.</span>
            </label>
            <label className="grid gap-1.5 min-w-0">
              <span className="text-[10px] font-black uppercase text-gray-500">Lisans bitisi</span>
              <input
                type="datetime-local"
                value={endInput}
                onChange={(e) => setEndInput(e.target.value)}
                className="min-w-0 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white touch-manipulation"
              />
              <span className="text-[9px] text-gray-600 font-bold break-words">Bos = sinirsiz bitis. Gün sonunu kapsamak icin saati 23:59 secin.</span>
            </label>
          </div>

          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              setMessage(null);
              startTransition(async () => {
                const res = await updateOrganizationLicenseDatesAction(organizationId, {
                  startsAt: isoOrNullFromLocal(startInput),
                  endsAt: isoOrNullFromLocal(endInput),
                });
                if ("error" in res && res.error) {
                  setError(res.error);
                  return;
                }
                setMessage("Lisans tarihleri guncellendi.");
                router.refresh();
              });
            }}
            className="min-h-11 w-full sm:w-auto rounded-xl border border-[#7c3aed]/40 bg-[#7c3aed]/15 px-4 py-2.5 text-[10px] font-black uppercase text-[#e9d5ff] sm:hover:bg-[#7c3aed]/25 disabled:opacity-40 touch-manipulation"
          >
            Lisans tarihlerini kaydet
          </button>

          <div className="border-t border-white/5 pt-5 space-y-3 min-w-0">
            <p className="text-[10px] font-black uppercase text-gray-500 break-words">Organizasyon statüsü (ticari / operasyonel)</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end min-w-0">
              <label className="grid gap-1.5 min-w-0 w-full sm:flex-1 sm:min-w-[12rem]">
                <span className="text-[10px] font-black uppercase text-gray-500">Statü</span>
                <select
                  value={statusSelect}
                  onChange={(e) => setStatusSelect(e.target.value as OrganizationStatus)}
                  className="min-h-11 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-base sm:text-xs text-white touch-manipulation"
                >
                  {ORGANIZATION_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {ORGANIZATION_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={pending || statusSelect === status}
                onClick={() => {
                  if (!window.confirm(`Statü "${ORGANIZATION_STATUS_LABELS[statusSelect]}" olarak kaydedilsin mi?`)) return;
                  setError(null);
                  setMessage(null);
                  startTransition(async () => {
                    const res = await superAdminSetOrganizationStatusAction(organizationId, statusSelect);
                    if ("error" in res && res.error) {
                      setError(res.error);
                      return;
                    }
                    setMessage("Statü guncellendi.");
                    router.refresh();
                  });
                }}
                className="min-h-11 w-full sm:w-auto shrink-0 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-[10px] font-black uppercase text-white sm:hover:bg-white/10 disabled:opacity-40 touch-manipulation"
              >
                Statüyü kaydet
              </button>
            </div>
            <p className="text-[9px] text-gray-600 font-bold leading-relaxed break-words">
              Askı / arşiv / yeniden aktifleştir akışı yukarıdaki &quot;Organizasyon durumu&quot; panelinden de yapılabilir. Bu liste
              doğrudan statü atamak içindir (ör. trial, expired).
            </p>
          </div>
        </>
      )}
    </section>
  );
}
