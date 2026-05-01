"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { getCoachPermissions } from "@/lib/auth/coachPermissions";
import { messageIfCoachCannotOperate } from "@/lib/coach/lifecycle";
import { withServerActionGuard } from "@/lib/observability/serverActionError";

type LocationRow = { id: string; name: string; color: string; organization_id: string };

async function resolveLocationActor() {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: true });
  if ("error" in resolved) return resolved;
  const actor = resolved.actor;
  const role = getSafeRole(actor.role);
  if (role !== "admin" && role !== "coach") return { error: "Bu işlem için yetkiniz yok." };
  const coachBlock = messageIfCoachCannotOperate(actor.role, actor.isActive ?? true);
  if (coachBlock) return { error: coachBlock };
  return { actor, role } as const;
}

function normalizeHexColor(input: string) {
  const raw = input.trim().toLowerCase();
  if (!raw) return "#6b7280";
  return /^#[0-9a-f]{6}$/.test(raw) ? raw : null;
}

export async function listLocationsForActor() {
  return withServerActionGuard("location.listLocationsForActor", async () => {
    const resolved = await resolveLocationActor();
    if ("error" in resolved) return { error: resolved.error };
    const { actor } = resolved;
    const adminClient = createSupabaseAdminClient();

    const { data, error } = await adminClient
      .from("locations")
      .select("id, name, color, organization_id")
      .eq("organization_id", actor.organizationId!)
      .order("name", { ascending: true });

    if (error) {
      if (error.message.toLowerCase().includes("relation") && error.message.toLowerCase().includes("locations")) {
        return { locations: [] as LocationRow[] };
      }
      return { error: `Lokasyonlar alınamadı: ${error.message}` };
    }
    return { locations: (data || []) as LocationRow[] };
  });
}

export async function createLocationAction(formData: FormData) {
  return withServerActionGuard("location.createLocationAction", async () => {
    const resolved = await resolveLocationActor();
    if ("error" in resolved) return { error: resolved.error };
    const { actor, role } = resolved;
    if (role === "coach") {
      const perms = await getCoachPermissions(actor.id, actor.organizationId!);
      if (!perms.can_create_lessons) return { error: "Lokasyon ekleme yetkiniz yok." };
    }

    const name = formData.get("name")?.toString().trim() || "";
    const color = normalizeHexColor(formData.get("color")?.toString() || "");
    if (!name) return { error: "Lokasyon adı zorunludur." };
    if (name.length < 2 || name.length > 80) return { error: "Lokasyon adı 2-80 karakter olmalıdır." };
    if (!color) return { error: "Renk formatı geçersiz. Örn: #22c55e" };

    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient.from("locations").insert({
      organization_id: actor.organizationId,
      name,
      color,
    });
    if (error) {
      if (error.code === "23505" || error.message.toLowerCase().includes("duplicate")) {
        return { error: "Bu lokasyon adı zaten mevcut." };
      }
      return { error: `Lokasyon oluşturulamadı: ${error.message}` };
    }

    revalidatePath("/dersler");
    revalidatePath("/haftalik-ders-programi");
    revalidatePath("/antrenman-yonetimi");
    return { success: true as const };
  });
}
