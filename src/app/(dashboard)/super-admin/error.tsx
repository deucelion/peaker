"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

export default function SuperAdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-w-0 space-y-4 rounded-[1.5rem] border border-red-500/20 bg-red-500/5 p-6 sm:p-8 overflow-x-hidden">
      <h1 className="break-words text-xl font-black italic uppercase text-white">Super Admin Yuklenemedi</h1>
      <p className="text-[11px] text-gray-400 font-bold break-words leading-relaxed">
        Sayfa verisi alinirken bir hata olustu. Genelde SUPABASE_SERVICE_ROLE_KEY eksik/yanlis veya Supabase baglantisi kopuk oldugunda gorulur.
      </p>
      {error?.message && (
        <pre className="text-[10px] text-red-300/90 whitespace-pre-wrap break-all rounded-xl border border-white/10 bg-black/30 p-3">
          {error.message}
        </pre>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="min-h-11 touch-manipulation rounded-xl bg-[#7c3aed] px-4 py-2.5 text-[10px] font-black uppercase text-white sm:hover:bg-[#6d28d9]"
        >
          Tekrar Dene
        </button>
        <Link
          href="/"
          className="inline-flex min-h-11 touch-manipulation items-center rounded-xl border border-white/10 px-4 py-2.5 text-[10px] font-black uppercase text-gray-300 sm:hover:border-[#7c3aed]/40 sm:hover:text-white"
        >
          Ana Sayfa
        </Link>
      </div>
    </div>
  );
}
