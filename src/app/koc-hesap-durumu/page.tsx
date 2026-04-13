import { redirect } from "next/navigation";
import { createServerSupabaseReadClient } from "@/lib/supabase/server-read";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { COACH_ACCOUNT_DISABLED_MESSAGE } from "@/lib/coach/lifecycle";
import KocHesapLogoutButton from "./KocHesapLogoutButton";

export default async function KocHesapDurumuPage() {
  const supabase = await createServerSupabaseReadClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !getSafeRole(profile.role)) redirect("/login");

  if (getSafeRole(profile.role) !== "coach") {
    redirect("/");
  }

  if (profile.is_active !== false) {
    redirect("/");
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-16 pb-[max(2rem,env(safe-area-inset-bottom,0px))] bg-[#09090b] min-w-0">
      <div className="w-full max-w-md space-y-5 sm:space-y-6 rounded-[1.5rem] border border-white/10 bg-[#121215] p-5 sm:p-8 shadow-2xl min-w-0">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-[#7c3aed]">Peaker</p>
          <h1 className="mt-2 text-xl sm:text-2xl font-black italic uppercase tracking-tight text-white break-words">Koç hesabı pasif</h1>
          <p className="mt-3 text-sm font-bold text-gray-400 leading-relaxed break-words">{COACH_ACCOUNT_DISABLED_MESSAGE}</p>
        </div>
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3">
          <p className="text-[10px] font-black uppercase text-amber-200/90">Durum</p>
          <p className="text-lg font-black italic text-white">Pasif</p>
        </div>
        <KocHesapLogoutButton />
      </div>
    </div>
  );
}
