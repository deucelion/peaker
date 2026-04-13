"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { isUuid } from "@/lib/validation/uuid";

function assertUuid(id: string | null | undefined): id is string {
  return isUuid(id);
}

export async function updateCoachProfileByAdmin(
  coachId: string,
  payload: { fullName: string; phone: string; specialization: string }
) {
  if (!assertUuid(coachId)) {
    return { error: "Gecersiz koc kimligi." };
  }

  const fullName = payload.fullName.trim();
  const phone = payload.phone.trim();
  const specialization = payload.specialization.trim();

  if (!fullName || fullName.length > 200) {
    return { error: "Ad soyad zorunlu ve makul uzunlukta olmalidir." };
  }
  if (phone.length > 40) return { error: "Telefon cok uzun." };
  if (specialization.length > 200) return { error: "Uzmanlik alani cok uzun." };

  const sessionClient = await createServerSupabaseClient();
  const { data: authData } = await sessionClient.auth.getUser();
  if (!authData.user) return { error: "Gecersiz oturum." };

  const { data: actor } = await sessionClient
    .from("profiles")
    .select("role, organization_id")
    .eq("id", authData.user.id)
    .maybeSingle();

  const actorRole = getSafeRole(actor?.role);
  if (actorRole !== "admin" && actorRole !== "super_admin") {
    return { error: "Bu islem yalnizca organizasyon admini veya super admin icindir." };
  }
  if (actorRole === "admin" && !actor?.organization_id) {
    return { error: "Organizasyon bilgisi eksik." };
  }

  const adminClient = createSupabaseAdminClient();
  const { data: target } = await adminClient
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", coachId)
    .maybeSingle();

  if (!target || getSafeRole(target.role) !== "coach") {
    return { error: "Koc bulunamadi." };
  }
  if (actorRole === "admin" && actor && target.organization_id !== actor.organization_id) {
    return { error: "Koc bu organizasyona ait degil." };
  }

  const payloadRow = {
    full_name: fullName,
    phone: phone || null,
    specialization: specialization || null,
  };

  const orgId = actor?.organization_id;
  const { error: updErr } =
    actorRole === "admin" && orgId
      ? await adminClient.from("profiles").update(payloadRow).eq("id", coachId).eq("organization_id", orgId)
      : await adminClient.from("profiles").update(payloadRow).eq("id", coachId);

  if (updErr) return { error: `Guncellenemedi: ${updErr.message}` };

  revalidatePath("/koclar");
  revalidatePath(`/koclar/${coachId}`);
  revalidatePath("/");
  return { success: true as const };
}
