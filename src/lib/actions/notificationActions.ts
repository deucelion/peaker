"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getUnreadNotificationCount(): Promise<{ count: number } | { error: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { error: "Gecersiz oturum." };

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);

  if (error) return { error: error.message };
  return { count: count ?? 0 };
}
