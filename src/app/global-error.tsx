"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="tr">
      <body className="min-h-[100dvh] min-w-0 bg-black text-white antialiased">
        <div className="flex min-h-[100dvh] min-w-0 flex-col items-center justify-center gap-6 overflow-x-hidden px-4 py-12 pt-[max(3rem,env(safe-area-inset-top,0px))] pb-[max(3rem,env(safe-area-inset-bottom,0px))]">
          <div className="w-full max-w-md min-w-0 space-y-4 rounded-[2rem] border border-red-500/30 bg-[#121215] p-6 text-center sm:p-10">
            <h1 className="break-words text-xl font-black uppercase italic">Kritik hata</h1>
            <p className="break-words text-[11px] font-bold uppercase leading-relaxed text-gray-400">
              Kök şablon yüklenemedi. Sayfayı yenileyin veya daha sonra tekrar deneyin.
            </p>
            {error?.message ? (
              <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/50 p-3 text-left text-[10px] text-red-300/90">
                {error.message}
              </pre>
            ) : null}
            <button
              type="button"
              onClick={() => reset()}
              className="min-h-11 touch-manipulation rounded-xl bg-[#7c3aed] px-6 py-3 text-[10px] font-black uppercase text-white sm:hover:bg-[#6d28d9]"
            >
              Tekrar dene
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
