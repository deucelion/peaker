"use server";


import { withServerActionGuard } from "@/lib/observability/serverActionError";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { messageIfAthleteCannotOperate } from "@/lib/athlete/lifecycle";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";

const MAX_AVATAR_BYTES = 4 * 1024 * 1024;
const AVATAR_BUCKET = "avatars";

async function resolveActiveAthlete() {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: true });
  if ("error" in resolved) return { error: resolved.error };

  const actor = resolved.actor;
  if (!actor.organizationId) return { error: "Profil dogrulanamadi." as const };
  if (getSafeRole(actor.role) !== "sporcu") return { error: "Bu islem yalnizca sporcu hesabi icindir." as const };

  const block = messageIfAthleteCannotOperate(actor.role, actor.isActive);
  if (block) return { error: block };

  return { userId: actor.id, organizationId: actor.organizationId };
}

function clampStr(s: string | null | undefined, max: number) {
  return (s ?? "").trim().slice(0, max);
}

export async function updateAthleteSelfProfile(formData: FormData) {
  return withServerActionGuard("athleteSelfProfile.updateAthleteSelfProfile", async () => {
  const resolved = await resolveActiveAthlete();
  if ("error" in resolved) return { error: resolved.error };

  const fullName = clampStr(formData.get("full_name")?.toString(), 200);
  if (fullName.length < 2) return { error: "Ad soyad en az 2 karakter olmalidir." };

  const heightRaw = formData.get("height")?.toString().trim();
  const weightRaw = formData.get("weight")?.toString().trim();
  const position = clampStr(formData.get("position")?.toString(), 80);
  const number = clampStr(formData.get("number")?.toString(), 20);

  let height: number | null = null;
  if (heightRaw) {
    const h = Number(heightRaw);
    if (!Number.isFinite(h) || h < 50 || h > 260) return { error: "Boy 50–260 cm araliginda olmalidir." };
    height = Math.round(h);
  }

  let weight: number | null = null;
  if (weightRaw) {
    const w = Number(weightRaw);
    if (!Number.isFinite(w) || w < 20 || w > 300) return { error: "Kilo 20–300 kg araliginda olmalidir." };
    weight = Math.round(w * 10) / 10;
  }

  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient
    .from("profiles")
    .update({
      full_name: fullName,
      height,
      weight,
      position: position || null,
      number: number || null,
    })
    .eq("id", resolved.userId)
    .eq("organization_id", resolved.organizationId);

  if (error) return { error: `Profil guncellenemedi: ${error.message}` };

  revalidatePath("/sporcu");
  return { success: true as const };
  });
}

export async function uploadAthleteAvatar(formData: FormData) {
  return withServerActionGuard("athleteSelfProfile.uploadAthleteAvatar", async () => {
  const resolved = await resolveActiveAthlete();
  if ("error" in resolved) return { error: resolved.error };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Gecerli bir dosya secin." };
  if (file.size > MAX_AVATAR_BYTES) return { error: "Dosya boyutu 4 MB altinda olmalidir." };

  const mime = file.type.toLowerCase();
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) {
    return { error: "Yalnizca JPEG, PNG, WebP veya GIF yuklenebilir." };
  }

  const ext =
    mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "jpg";
  const objectPath = `${resolved.userId}/${crypto.randomUUID()}.${ext}`;

  const adminClient = createSupabaseAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await adminClient.storage.from(AVATAR_BUCKET).upload(objectPath, buffer, {
    contentType: mime,
    upsert: true,
  });
  if (upErr) return { error: `Yukleme basarisiz: ${upErr.message}` };

  const { data: pub } = adminClient.storage.from(AVATAR_BUCKET).getPublicUrl(objectPath);
  const publicUrl = pub?.publicUrl;
  if (!publicUrl) return { error: "Public URL alinamadi." };

  const { error: dbErr } = await adminClient
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", resolved.userId)
    .eq("organization_id", resolved.organizationId);

  if (dbErr) return { error: `Profil guncellenemedi: ${dbErr.message}` };

  revalidatePath("/sporcu");
  return { success: true as const, publicUrl };
  });
}
