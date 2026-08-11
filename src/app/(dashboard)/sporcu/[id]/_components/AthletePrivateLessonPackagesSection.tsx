"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Package, Pencil, PlusCircle } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { PrivateLessonPackageFormModal } from "@/components/privateLessons/PrivateLessonPackageFormModal";
import { PrivateLessonPackageEditModal } from "@/components/privateLessons/PrivateLessonPackageEditModal";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";
import {
  listPrivateLessonFormOptions,
  listPrivateLessonPackagesForAthleteId,
} from "@/lib/actions/privateLessonPackageActions";
import { formatCurrencyTRY } from "@/lib/privateLessons/packageMath";
import {
  PACKAGE_LIFECYCLE_TONE,
  resolvePackageLifecycleStatus,
  PACKAGE_LIFECYCLE_LABEL,
} from "@/lib/privateLessons/packageStatus";
import type { PrivateLessonPackage } from "@/lib/types";

type Props = {
  athleteId: string;
  athleteName: string;
};

export function AthletePrivateLessonPackagesSection({ athleteId, athleteName }: Props) {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<PrivateLessonPackage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editPkg, setEditPkg] = useState<PrivateLessonPackage | null>(null);
  const [athletes, setAthletes] = useState<Array<{ id: string; full_name: string }>>([]);
  const [coaches, setCoaches] = useState<Array<{ id: string; full_name: string }>>([]);
  const [viewerRole, setViewerRole] = useState<"admin" | "coach">("admin");
  const [viewerId, setViewerId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [listRes, optRes] = await Promise.all([
      listPrivateLessonPackagesForAthleteId(athleteId),
      listPrivateLessonFormOptions(),
    ]);
    if ("error" in listRes) {
      setError(listRes.error);
      setPackages([]);
    } else {
      setPackages(listRes.packages);
    }
    if (!("error" in optRes)) {
      setAthletes(optRes.athletes);
      setCoaches(optRes.coaches);
      setViewerRole(optRes.viewerRole);
      setViewerId(optRes.viewerId);
    }
    setLoading(false);
  }, [athleteId]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  return (
    <section className={`${uiBrandingClasses.card.base} space-y-4 rounded-2xl !p-4 sm:!p-5`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className={`${uiBrandingClasses.typography.h2Sm} text-sm tracking-widest`}>
            Özel ders paketleri
          </h2>
          <p className={`${uiBrandingClasses.kpi.cardHint} mt-1 text-[10px] font-semibold`}>
            Bu sporcuya tanımlı paketler ve tahsilat özeti
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={`${uiBrandingClasses.button.primary} inline-flex min-h-10 items-center justify-center gap-2 px-4 text-[10px] tracking-widest`}
        >
          <PlusCircle size={14} aria-hidden />
          Yeni özel ders paketi
        </button>
      </div>

      {loading ? (
        <div className={`${uiBrandingClasses.loading.inline} py-8`}>
          <Loader2
            className={`${uiBrandingClasses.loading.inlineSpinner} size-4 animate-spin text-[color:var(--peaker-ui-PRIMARY)]`}
            aria-hidden
          />
          Yükleniyor…
        </div>
      ) : error ? (
        <p className="text-[11px] font-bold text-red-300">{error}</p>
      ) : packages.length === 0 ? (
        <EmptyState
          variant="no_data"
          icon={Package}
          title="Henüz özel ders paketi yok"
          description="Bu sporcuya henüz özel ders paketi tanımlanmamış."
          primaryAction={{ label: "Paket tanımla", onClick: () => setModalOpen(true) }}
        />
      ) : (
        <ul className={`${uiBrandingClasses.data.tableShell} divide-y divide-white/5 overflow-hidden rounded-xl`}>
          {packages.map((pkg) => {
            const lifecycle = pkg.lifecycleStatus ?? resolvePackageLifecycleStatus(pkg);
            return (
              <li
                key={pkg.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className={`${uiBrandingClasses.kpi.cardValue} truncate text-sm`}>{pkg.packageName}</p>
                  <p className={`${uiBrandingClasses.kpi.cardHint} text-[10px] font-semibold`}>
                    {pkg.remainingLessons}/{pkg.totalLessons} ders · {formatCurrencyTRY(pkg.amountPaid)} /{" "}
                    {formatCurrencyTRY(pkg.totalPrice)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${PACKAGE_LIFECYCLE_TONE[lifecycle]}`}
                  >
                    {PACKAGE_LIFECYCLE_LABEL[lifecycle]}
                  </span>
                  {lifecycle !== "cancelled" && lifecycle !== "refunded" ? (
                    <button
                      type="button"
                      onClick={() => setEditPkg(pkg)}
                      className={`${uiBrandingClasses.button.ghost} inline-flex min-h-9 items-center gap-1 px-2 py-1 text-[9px] text-gray-300 sm:hover:border-[color-mix(in_srgb,var(--peaker-ui-PRIMARY)_40%,transparent)] sm:hover:text-white`}
                    >
                      <Pencil size={10} aria-hidden />
                      Düzenle
                    </button>
                  ) : null}
                  <Link
                    href={`/ozel-ders-paketleri/${pkg.id}`}
                    className={`ui-breadcrumb__link rounded-lg border border-white/5 px-2 py-1 text-[9px] font-black uppercase`}
                  >
                    Detay
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modalOpen ? (
        <PrivateLessonPackageFormModal
          key={`create-${athleteId}`}
          open
          onClose={() => setModalOpen(false)}
          onSuccess={() => void load()}
          athletes={athletes}
          coaches={coaches}
          viewerRole={viewerRole}
          viewerId={viewerId}
          lockedAthleteId={athleteId}
          lockedAthleteName={athleteName}
        />
      ) : null}

      {editPkg ? (
        <PrivateLessonPackageEditModal
          key={`edit-${editPkg.id}`}
          open
          onClose={() => setEditPkg(null)}
          onSuccess={() => void load()}
          pkg={editPkg}
          coaches={coaches}
          viewerRole={viewerRole}
        />
      ) : null}
    </section>
  );
}
