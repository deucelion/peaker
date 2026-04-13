"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

export default function AppError({
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
    <div className="flex min-h-[100dvh] min-w-0 flex-col items-center justify-center gap-6 overflow-x-hidden bg-black px-4 py-12 pt-[max(3rem,env(safe-area-inset-top,0px))] pb-[max(3rem,env(safe-area-inset-bottom,0px))] text-white">
      <div className="w-full max-w-md min-w-0 space-y-4 rounded-[2rem] border border-red-500/20 bg-[#121215] p-6 text-center shadow-xl sm:p-10">
        <h1 className="break-words text-xl font-black uppercase italic tracking-tighter">Uygulama hatası</h1>
        <p className="break-words text-[11px] font-bold uppercase leading-relaxed tracking-widest text-gray-400">
          Sayfa render edilirken bir hata oluştu. Tekrar deneyebilir veya giriş sayfasına dönebilirsiniz.
        </p>
        {error?.message ? (
          <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-white/10 bg-black/40 p-3 text-left text-[10px] text-red-300/90">
            {error.message}
          </pre>
        ) : null}
        <div className="flex min-w-0 flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="min-h-11 touch-manipulation rounded-xl bg-[#7c3aed] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white sm:hover:bg-[#6d28d9]"
          >
            Tekrar dene
          </button>
          <Link
            href="/login"
            className="inline-flex min-h-11 touch-manipulation items-center justify-center rounded-xl border border-white/10 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-300 sm:hover:border-[#7c3aed]/40"
          >
            Giriş
          </Link>
        </div>
      </div>
    </div>
  );
}
