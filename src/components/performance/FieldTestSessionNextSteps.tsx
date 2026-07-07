import Link from "next/link";
import { BarChart3, ClipboardCheck, Download, TrendingUp } from "lucide-react";
import { PATHS } from "@/lib/navigation/routeRegistry";

type FieldTestSessionNextStepsProps = {
  sessionDate: string;
  className?: string;
};

export function FieldTestSessionNextSteps({ sessionDate, className = "" }: FieldTestSessionNextStepsProps) {
  return (
    <section
      className={`rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 ${className}`}
      aria-label="Oturum sonrası önerilen adımlar"
    >
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-200">Kayıt tamam · sıradaki adımlar</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        <NextStep href={`${PATHS.sahaTestleri}/genel-rapor`} icon={BarChart3} label="Takım raporunu gör" />
        <NextStep href={PATHS.performans} icon={TrendingUp} label="Performans sinyalleri" />
        <NextStep href={`${PATHS.sahaTestleri}/oturum/${sessionDate}`} icon={Download} label="Oturuma dön" />
      </ul>
      <p className="mt-2 text-[8px] font-bold uppercase tracking-wide text-gray-500">
        CSV indirme oturum ekranındaki dışa aktar düğmesiyle de yapılabilir.
      </p>
    </section>
  );
}

function NextStep({ href, icon: Icon, label }: { href: string; icon: typeof BarChart3; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 text-[9px] font-black uppercase tracking-wide text-gray-200 hover:border-emerald-400/30"
      >
        <Icon size={14} className="shrink-0 text-emerald-300" aria-hidden />
        {label}
      </Link>
    </li>
  );
}
