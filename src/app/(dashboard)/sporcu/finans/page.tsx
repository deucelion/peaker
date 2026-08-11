"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import Notification from "@/components/Notification";
import { AthleteFinanceTimeline } from "@/components/finance/AthleteFinanceTimeline";
import { uiBrandingClasses } from "@/lib/ui/branding/uiBrandingClasses";
import { getMyFinanceDetailForAthlete } from "@/lib/actions/financeActions";
import type { AthleteFinanceDetail } from "@/lib/types";

export default function AthleteFinanceDetailPage() {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<AthleteFinanceDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<
    "permission_denied" | "auth_required" | "invalid_input" | "fetch_error" | null
  >(null);

  useEffect(() => {
    async function run() {
      setLoading(true);
      const res = await getMyFinanceDetailForAthlete();
      if ("error" in res) {
        setSnapshot(null);
        setMessage(res.error);
        setMessageKind(
          ("errorKind" in res && typeof res.errorKind === "string"
            ? (res.errorKind as "permission_denied" | "auth_required" | "invalid_input" | "fetch_error")
            : "fetch_error")
        );
      } else {
        setSnapshot(res);
        setMessageKind(null);
      }
      setLoading(false);
    }
    void run();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[45dvh] items-center justify-center">
        <Loader2
          className="size-10 animate-spin text-[color:var(--peaker-ui-PRIMARY)]"
          aria-hidden
        />
      </div>
    );
  }

  if (!snapshot) {
    if (messageKind === "permission_denied") {
      return (
        <div className="space-y-4">
          <Link href="/sporcu" className="ui-breadcrumb__link text-[10px] font-black uppercase">
            ← Sporcu Paneli
          </Link>
          <div
            className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-amber-100"
            role="status"
            aria-live="polite"
          >
            <p className="text-[11px] font-black uppercase tracking-wide">Bu alanı görüntüleme yetkiniz yok.</p>
            <p className="mt-1 text-[10px] font-semibold normal-case text-amber-200/80">{message}</p>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <Link href="/sporcu" className="ui-breadcrumb__link text-[10px] font-black uppercase">
          ← Sporcu Paneli
        </Link>
        <Notification message={message || "Finans detay alınamadı."} variant="error" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-[max(4rem,env(safe-area-inset-bottom,0px))]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/sporcu" className="ui-breadcrumb__link text-[10px] font-black uppercase">
          ← Sporcu Paneli
        </Link>
        <h1 className={`${uiBrandingClasses.typography.h1} text-2xl`}>Finans Detayı</h1>
      </div>
      <AthleteFinanceTimeline snapshot={snapshot} mode="readonly" accent="purple" />
    </div>
  );
}
