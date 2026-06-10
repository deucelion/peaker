"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, Loader2, ChevronRight } from "lucide-react";
import { listOrganizationsForSuperAdminPasswordHub } from "@/lib/actions/adminPasswordActions";

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
      className={`bg-[#121215] border border-[#7c3aed]/20 rounded-[1.5rem] sm:rounded-[2rem] min-w-0 overflow-hidden ${
        compact ? "p-4 sm:p-5" : "p-5 sm:p-6"
      }`}
    >
      <div className="flex items-start gap-3 min-w-0 mb-4">
        <KeyRound className="shrink-0 text-[#7c3aed]" size={20} aria-hidden />
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-black italic text-white uppercase break-words">
            Kullanıcı şifre yönetimi
          </h3>
          <p className="text-[10px] text-gray-500 font-bold mt-1 uppercase tracking-wide break-words">
            Organizasyon seçin; o org&apos;daki admin, koç ve sporculara doğrudan yeni şifre atayın.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-500 py-6">
          <Loader2 className="animate-spin text-[#7c3aed]" size={16} aria-hidden />
          Organizasyonlar yükleniyor...
        </div>
      ) : null}

      {error ? (
        <p className="text-[11px] font-bold text-red-300/90 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 break-words">
          {error}
        </p>
      ) : null}

      {!loading && !error && organizations.length === 0 ? (
        <p className="text-[10px] text-gray-500 font-bold uppercase py-4">Henüz organizasyon yok.</p>
      ) : null}

      {!loading && !error && organizations.length > 0 ? (
        <div className="grid gap-2 min-w-0">
          {organizations.map((org) => {
            const label = org.name?.trim() || `ORG-${org.id.slice(0, 8).toUpperCase()}`;
            return (
              <Link
                key={org.id}
                href={`/super-admin/${org.id}#kullanici-sifreleri`}
                className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-[11px] font-black uppercase text-gray-200 transition sm:hover:border-[#7c3aed]/40 sm:hover:bg-[#7c3aed]/10 touch-manipulation"
              >
                <span className="break-words">{label}</span>
                <ChevronRight size={14} className="shrink-0 text-[#7c3aed]" aria-hidden />
              </Link>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
