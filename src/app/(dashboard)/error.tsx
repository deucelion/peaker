"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="ui-page flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4 py-16">
      <div className="max-w-lg space-y-4 rounded-[2rem] border border-red-500/20 bg-red-500/5 p-10 text-center shadow-xl">
        <h1 className="text-2xl font-black italic uppercase tracking-tighter text-white">Bir şeyler ters gitti</h1>
        <p className="text-[11px] font-bold uppercase leading-relaxed tracking-widest text-gray-400">
          Bu bölüm yüklenirken beklenmeyen bir hata oluştu. Ağ veya oturum sorunu olabilir; tekrar deneyebilir veya ana sayfaya dönebilirsiniz.
        </p>
        {error?.message ? (
          <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-white/10 bg-black/40 p-4 text-left text-[10px] text-red-300/90">
            {error.message}
          </pre>
        ) : null}
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-xl bg-[#7c3aed] px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white transition sm:hover:bg-[#6d28d9]"
          >
            Tekrar dene
          </button>
          <Link
            href="/"
            className="rounded-xl border border-white/10 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-gray-300 transition sm:hover:border-[#7c3aed]/40 sm:hover:text-white"
          >
            Ana sayfa
          </Link>
        </div>
      </div>
    </div>
  );
}
