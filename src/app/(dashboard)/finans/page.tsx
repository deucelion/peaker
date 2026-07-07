"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { fetchMeRoleClient } from "@/lib/auth/meRoleClient";
import { PATHS } from "@/lib/navigation/routeRegistry";
import { FinansYonetimi } from "@/components/finance/FinansYonetimi";

function FinansRoute() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const me = await fetchMeRoleClient();
      if (cancelled) return;
      if (me.ok && (me.role === "admin" || me.role === "super_admin")) {
        router.replace(`${PATHS.tahsilatMerkezi}?bolum=sporcular`);
        return;
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-[45dvh] items-center justify-center text-green-500">
        <Loader2 className="size-10 animate-spin" aria-hidden />
      </div>
    );
  }

  return <FinansYonetimi embedded={false} />;
}

export default function FinansPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[45dvh] items-center justify-center text-green-500">
          <Loader2 className="size-10 animate-spin" aria-hidden />
        </div>
      }
    >
      <FinansRoute />
    </Suspense>
  );
}
