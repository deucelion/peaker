"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SporcuHesapLogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      disabled={busy}
      className="min-h-11 w-full touch-manipulation rounded-xl border border-white/15 bg-white/5 py-3 text-[11px] font-black uppercase tracking-wider text-white transition sm:hover:border-red-500/40 sm:hover:bg-red-500/10 disabled:opacity-50"
    >
      {busy ? "Cikis yapiliyor…" : "Oturumu kapat"}
    </button>
  );
}
