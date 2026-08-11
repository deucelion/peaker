import Link from "next/link";
import { WifiOff } from "lucide-react";

export default function OfflineFallbackPage() {
  return (
    <div className="ui-page flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center text-white pb-[env(safe-area-inset-bottom,0px)]">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl ui-kpi-chip--brand">
        <WifiOff className="text-[color:var(--peaker-ui-PRIMARY)]" size={32} aria-hidden />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[color:var(--peaker-ui-PRIMARY)]">
        Çevrimdışı
      </p>
      <h1 className="mt-3 text-2xl font-black uppercase italic tracking-tight">Bağlantı yok</h1>
      <p className="mt-3 max-w-md text-sm font-bold leading-relaxed text-gray-500">
        Sayfa yüklenemedi. Güvenli taslaklarınız cihazda saklanır; bağlantı gelince panelden
        senkronize edebilirsiniz. Oturum ve canlı veriler bu sayfada güncellenmez.
      </p>
      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <Link
          href="/"
          className="ui-btn-primary inline-flex min-h-11 items-center justify-center rounded-xl px-6 text-[10px] font-black uppercase text-white"
        >
          Yeniden dene
        </Link>
        <Link
          href="/login"
          className="ui-btn-ghost inline-flex min-h-11 items-center justify-center rounded-xl px-6 text-[10px] font-black uppercase text-gray-300"
        >
          Giriş
        </Link>
      </div>
    </div>
  );
}
