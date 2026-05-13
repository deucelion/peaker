"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Filter,
  Inbox,
  Sparkles,
  ShieldOff,
  type LucideIcon,
} from "lucide-react";

/**
 * Standart EmptyState (Faz 4.3 / 4.4).
 *
 * Tüm "veri yok / yetki yok / ilk kullanım / filtre boş / hata" durumlarını
 * tek bir component üzerinden tutarlı dilde sunar. Sayfalar bu component'i
 * kullandığında dashboard'daki "veri yok" cümleleri otomatik standartlaşır.
 *
 * Kullanım:
 *   <EmptyState variant="no_data" description="Bu aralıkta ders kaydı yok." />
 *   <EmptyState variant="no_permission" description="Bu paneli görüntüleme yetkiniz yok." />
 *   <EmptyState variant="onboarding" title="İlk sporcunu ekle" description="..."
 *               primaryAction={{ label: "Sporcu ekle", href: "/oyuncular" }} />
 *   <EmptyState variant="filtered_empty" description="Filtreyi temizleyip tekrar deneyin."
 *               primaryAction={{ label: "Filtreleri sıfırla", onClick: reset }} />
 *   <EmptyState variant="error" description={errorMessage}
 *               primaryAction={{ label: "Tekrar dene", onClick: refresh }} />
 */

export type EmptyStateVariant =
  | "no_data"
  | "no_permission"
  | "onboarding"
  | "filtered_empty"
  | "error";

export type EmptyStateAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
};

type VariantConfig = {
  icon: LucideIcon;
  iconWrapClass: string;
  iconClass: string;
  borderClass: string;
  bgClass: string;
  titleClass: string;
  defaultTitle: string;
  primaryClass: string;
  ariaLive: "polite" | "assertive";
};

const VARIANT_CONFIG: Record<EmptyStateVariant, VariantConfig> = {
  no_data: {
    icon: Inbox,
    iconWrapClass: "border-white/10 bg-white/5",
    iconClass: "text-gray-400",
    borderClass: "border-dashed border-white/10",
    bgClass: "bg-black/20",
    titleClass: "text-gray-200",
    defaultTitle: "Kayıt bulunamadı",
    primaryClass:
      "bg-emerald-500 text-black hover:bg-emerald-400 shadow-md shadow-emerald-500/15",
    ariaLive: "polite",
  },
  no_permission: {
    icon: ShieldOff,
    iconWrapClass: "border-amber-500/35 bg-amber-500/10",
    iconClass: "text-amber-300",
    borderClass: "border-amber-500/30",
    bgClass: "bg-amber-500/5",
    titleClass: "text-amber-100",
    defaultTitle: "Bu içeriği görüntüleme yetkiniz yok",
    primaryClass:
      "bg-amber-500/20 text-amber-50 hover:bg-amber-500/30 border border-amber-500/40",
    ariaLive: "polite",
  },
  onboarding: {
    icon: Sparkles,
    iconWrapClass: "border-emerald-500/35 bg-emerald-500/10",
    iconClass: "text-emerald-300",
    borderClass: "border-emerald-500/25",
    bgClass: "bg-emerald-500/[0.04]",
    titleClass: "text-emerald-100",
    defaultTitle: "İlk adımı atalım",
    primaryClass:
      "bg-emerald-500 text-black hover:bg-emerald-400 shadow-md shadow-emerald-500/15",
    ariaLive: "polite",
  },
  filtered_empty: {
    icon: Filter,
    iconWrapClass: "border-white/10 bg-white/5",
    iconClass: "text-gray-400",
    borderClass: "border-dashed border-white/10",
    bgClass: "bg-black/20",
    titleClass: "text-gray-200",
    defaultTitle: "Filtreye uyan kayıt yok",
    primaryClass:
      "bg-white/10 text-gray-100 hover:bg-white/15 border border-white/15",
    ariaLive: "polite",
  },
  error: {
    icon: AlertTriangle,
    iconWrapClass: "border-red-500/35 bg-red-500/10",
    iconClass: "text-red-300",
    borderClass: "border-red-500/30",
    bgClass: "bg-red-500/5",
    titleClass: "text-red-100",
    defaultTitle: "Bir sorun oluştu",
    primaryClass:
      "bg-red-500/20 text-red-50 hover:bg-red-500/30 border border-red-500/40",
    ariaLive: "assertive",
  },
};

export type EmptyStateProps = {
  variant?: EmptyStateVariant;
  title?: string;
  description: string;
  reason?: string;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  /** Yatay düşük yükseklik (tablo içi vb.) */
  compact?: boolean;
  /** Dış padding/margin'i kapat (kart içi gömülü kullanım için). */
  bare?: boolean;
  /** Ek class'lar. */
  className?: string;
  /** İkonu özel olarak değiştir. */
  icon?: LucideIcon;
  /** İkonu tamamen gizle. */
  hideIcon?: boolean;
};

function ActionButton({
  action,
  primary,
  primaryClass,
}: {
  action: EmptyStateAction;
  primary: boolean;
  primaryClass: string;
}) {
  const baseClass =
    "inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-[11px] font-black uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const styleClass = primary
    ? primaryClass
    : "border border-white/15 bg-black/30 text-gray-300 hover:bg-white/5";

  if (action.href && !action.disabled) {
    return (
      <Link href={action.href} className={`${baseClass} ${styleClass}`}>
        {action.label}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      className={`${baseClass} ${styleClass}`}
    >
      {action.label}
    </button>
  );
}

export default function EmptyState({
  variant = "no_data",
  title,
  description,
  reason,
  primaryAction,
  secondaryAction,
  compact = false,
  bare = false,
  className = "",
  icon,
  hideIcon = false,
}: EmptyStateProps) {
  const cfg = VARIANT_CONFIG[variant];
  const Icon = icon || cfg.icon;
  const padding = compact ? "px-4 py-6" : "px-4 py-8 sm:px-6 sm:py-10";

  const wrapperClass = bare
    ? `text-center ${className}`
    : `rounded-xl border ${cfg.borderClass} ${cfg.bgClass} text-center ${padding} ${className}`;

  return (
    <div role="status" aria-live={cfg.ariaLive} className={wrapperClass}>
      {!hideIcon ? (
        <div
          className={`mx-auto mb-3 inline-flex size-10 items-center justify-center rounded-full border ${cfg.iconWrapClass}`}
          aria-hidden
        >
          <Icon className={`size-5 ${cfg.iconClass}`} />
        </div>
      ) : null}
      <p className={`text-xs font-black uppercase tracking-wide ${cfg.titleClass}`}>
        {title || cfg.defaultTitle}
      </p>
      <p className="mx-auto mt-1 max-w-md text-xs font-semibold text-gray-400">
        {description}
      </p>
      {reason ? (
        <p className="mx-auto mt-2 max-w-md text-[11px] font-medium text-gray-500">
          {reason}
        </p>
      ) : null}
      {primaryAction || secondaryAction ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {primaryAction ? (
            <ActionButton action={primaryAction} primary primaryClass={cfg.primaryClass} />
          ) : null}
          {secondaryAction ? (
            <ActionButton action={secondaryAction} primary={false} primaryClass={cfg.primaryClass} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
