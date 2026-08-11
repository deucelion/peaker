"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, Loader2, ChevronRight } from "lucide-react";
import { listOrganizationsForSuperAdminPasswordHub } from "@/lib/actions/adminPasswordActions";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";

export function SuperAdminPasswordHub({ compact = false }: { compact?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string | null }>>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      const res = await listOrganizationsForSuperAdminPasswordHub();
      if (cancelled) return;
      if ("error" in res && res.error) {
        setError(res.error);
        setOrganizations([]);
      } else {
        setOrganizations(("organizations" in res && res.organizations) || []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      className={`${uiBrandingClasses.card.base} ${uiBrandingClasses.kpi.chipBrand} min-w-0 overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] ${
        compact ? "p-4 sm:p-5" : "p-5 sm:p-6"
      }`}
    >
      <div className="mb-4 flex min-w-0 items-start gap-3">
        <KeyRound
          className="shrink-0 text-[color:var(--peaker-ui-PRIMARY)]"
          size={20}
          aria-hidden
        />
        <div className="min-w-0">
          <h3 className="break-words text-base font-black uppercase italic text-white sm:text-lg">
            Kullanıcı şifre yönetimi
          </h3>
          <p className="mt-1 break-words text-[10px] font-bold uppercase tracking-wide text-gray-500">
            Organizasyon seçin; o org&apos;daki admin, koç ve sporculara doğrudan yeni şifre atayın.
          </p>
        </div>
      </div>

      {loading ? (
        <div className={`${uiBrandingClasses.loading.inline} py-6`}>
          <Loader2
            className={`${uiBrandingClasses.loading.inlineSpinner} animate-spin text-[color:var(--peaker-ui-PRIMARY)]`}
            size={16}
            aria-hidden
          />
          Organizasyonlar yükleniyor...
        </div>
      ) : null}

      {error ? (
        <p className="break-words rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] font-bold text-red-300/90">
          {error}
        </p>
      ) : null}

      {!loading && !error && organizations.length === 0 ? (
        <p className={`${uiBrandingClasses.empty.description} py-4 text-center text-[10px] font-bold uppercase`}>
          Henüz organizasyon yok.
        </p>
      ) : null}

      {!loading && !error && organizations.length > 0 ? (
        <div className="grid min-w-0 gap-2">
          {organizations.map((org) => {
            const label = org.name?.trim() || `ORG-${org.id.slice(0, 8).toUpperCase()}`;
            return (
              <Link
                key={org.id}
                href={`/super-admin/${org.id}#kullanici-sifreleri`}
                className={`${uiBrandingClasses.card.inner} flex min-h-11 touch-manipulation items-center justify-between gap-3 px-4 py-3 text-[11px] font-black uppercase text-gray-200 transition sm:hover:border-[color-mix(in_srgb,var(--peaker-ui-PRIMARY)_40%,transparent)] sm:hover:bg-[color-mix(in_srgb,var(--peaker-ui-PRIMARY)_10%,transparent)]`}
              >
                <span className="break-words">{label}</span>
                <ChevronRight
                  size={14}
                  className="shrink-0 text-[color:var(--peaker-ui-PRIMARY)]"
                  aria-hidden
                />
              </Link>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
