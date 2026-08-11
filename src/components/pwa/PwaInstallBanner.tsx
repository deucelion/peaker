"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

const DISMISS_KEY = "peaker_pwa_install_dismissed_v1";

function readDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function PwaInstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(readDismissed);
  const iosHint = !isStandalone() && isIosSafari();

  useEffect(() => {
    if (isStandalone() || isIosSafari()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    setDismissed(true);
    setDeferred(null);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  if (dismissed || isStandalone()) return null;
  if (!deferred && !iosHint) return null;

  return (
    <div className="ui-kpi-chip--brand mb-3 rounded-xl px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 text-[11px] font-bold text-[color:color-mix(in_srgb,var(--peaker-ui-PRIMARY)_70%,white)]">
          {iosHint ? (
            <>
              <p className="font-black uppercase tracking-wide text-white">Ana ekrana ekle</p>
              <p className="mt-1 text-gray-400">
                Safari&apos;de <Share size={12} className="inline" aria-hidden /> Paylaş → Ana Ekrana Ekle
              </p>
            </>
          ) : (
            <>
              <p className="font-black uppercase tracking-wide text-white">PEAKER uygulaması</p>
              <p className="mt-1 text-gray-400">Daha hızlı erişim için yükleyin.</p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="ui-btn-ghost shrink-0 rounded-lg p-1 text-gray-500 touch-manipulation"
          aria-label="Kapat"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
      {deferred ? (
        <button
          type="button"
          onClick={() => void deferred.prompt()}
          className="ui-btn-primary mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg px-3 text-[10px] font-black uppercase text-white touch-manipulation"
        >
          <Download size={14} aria-hidden /> Yükle
        </button>
      ) : null}
    </div>
  );
}
