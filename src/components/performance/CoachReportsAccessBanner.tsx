import Link from "next/link";
import { Info } from "lucide-react";
import { PATHS } from "@/lib/navigation/routeRegistry";

export function CoachReportsAccessBanner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 ${className}`}
      role="status"
    >
      <Info size={16} className="mt-0.5 shrink-0 text-amber-300" aria-hidden />
      <p className="text-[10px] font-bold leading-relaxed text-amber-100">
        Performans merkezi menüsü hesabınızda kapalı; detayları bu sporcu profilinden görüntülüyorsunuz. Tam rapor
        modülü için yöneticinizden{" "}
        <span className="font-black uppercase tracking-wide">rapor görüntüleme</span> iznini açmasını isteyin.{" "}
        <Link href={PATHS.performansAyarlar} className="text-[#fde68a] underline-offset-2 hover:underline">
          Ayarlar
        </Link>
      </p>
    </div>
  );
}
