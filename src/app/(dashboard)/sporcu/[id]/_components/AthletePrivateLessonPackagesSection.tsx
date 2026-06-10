"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Package, Pencil, PlusCircle } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import { PrivateLessonPackageFormModal } from "@/components/privateLessons/PrivateLessonPackageFormModal";
import { PrivateLessonPackageEditModal } from "@/components/privateLessons/PrivateLessonPackageEditModal";
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
    <section className="rounded-2xl border border-white/10 bg-[#121215] p-4 sm:p-5 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-white">Özel ders paketleri</h2>
          <p className="mt-1 text-[10px] font-semibold text-gray-500">
            Bu sporcuya tanımlı paketler ve tahsilat özeti
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#7c3aed] px-4 text-[10px] font-black uppercase tracking-widest text-white"
        >
          <PlusCircle size={14} aria-hidden />
          Yeni özel ders paketi
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-[10px] font-black uppercase text-gray-500">
          <Loader2 className="size-4 animate-spin text-[#7c3aed]" aria-hidden />
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
        <ul className="divide-y divide-white/5 rounded-xl border border-white/8 overflow-hidden">
          {packages.map((pkg) => {
            const lifecycle = pkg.lifecycleStatus ?? resolvePackageLifecycleStatus(pkg);
            return (
              <li key={pkg.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-black text-white truncate">{pkg.packageName}</p>
                  <p className="text-[10px] font-semibold text-gray-500">
                    {pkg.remainingLessons}/{pkg.totalLessons} ders · {formatCurrencyTRY(pkg.amountPaid)} /{" "}
                    {formatCurrencyTRY(pkg.totalPrice)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${PACKAGE_LIFECYCLE_TONE[lifecycle]}`}
                  >
                    {PACKAGE_LIFECYCLE_LABEL[lifecycle]}
                  </span>
                  {lifecycle !== "cancelled" && lifecycle !== "refunded" ? (
                    <button
                      type="button"
                      onClick={() => setEditPkg(pkg)}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[9px] font-black uppercase text-gray-300 hover:border-[#7c3aed]/40 hover:text-white"
                    >
                      <Pencil size={10} aria-hidden />
                      Düzenle
                    </button>
                  ) : null}
                  <Link
                    href={`/ozel-ders-paketleri/${pkg.id}`}
                    className="rounded-lg border border-white/10 px-2 py-1 text-[9px] font-black uppercase text-[#c4b5fd]"
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
