"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { assertCriticalSchemaReady } from "@/lib/diagnostics/systemHealth";
import { extractSessionOrganizationId, extractSessionRole } from "@/lib/auth/sessionClaims";
import { isUuid } from "@/lib/validation/uuid";
import { withServerActionGuard } from "@/lib/observability/serverActionError";
import {
  invalidateOrganizationTimeZoneCache,
  isLikelyIanaTimeZone,
} from "@/lib/organization/timeZone";

const NAME_MIN = 2;
const NAME_MAX = 120;

function assertUuid(id: string | null | undefined): id is string {
  return isUuid(id);
}

async function resolveOrganizationActor(organizationId: string): Promise<
  | { error: string }
  | { ok: true; role: "admin" | "super_admin" }
> {
  if (!assertUuid(organizationId)) return { error: "Gecersiz organizasyon kimligi." };
  const schemaError = await assertCriticalSchemaReady(["organization_lifecycle"]);
  if (schemaError) return { error: schemaError };

  const sessionClient = await createServerSupabaseClient();
  const { data: authData } = await sessionClient.auth.getUser();
  if (!authData.user) return { error: "Gecersiz oturum." };

  let actor: { role?: string | null; organization_id?: string | null } | null = null;
  const byId = await sessionClient
    .from("profiles")
    .select("role, organization_id")
    .eq("id", authData.user.id)
    .maybeSingle();
  actor = byId.data ?? null;
  if (!actor) {
    const adminClient = createSupabaseAdminClient();
    const byIdAdmin = await adminClient
      .from("profiles")
      .select("role, organization_id")
      .eq("id", authData.user.id)
      .maybeSingle();
    actor = byIdAdmin.data ?? null;
    if (!actor) {
      actor = {
        role: extractSessionRole(authData.user),
        organization_id: extractSessionOrganizationId(authData.user),
      };
    }
  }

  const role = getSafeRole(actor?.role);
  if (role === "super_admin") return { ok: true, role: "super_admin" };
  if (role === "admin" && actor?.organization_id === organizationId) return { ok: true, role: "admin" };
  return { error: "Bu islem icin yetkiniz yok." };
}

export async function updateOrganizationDisplayNameAction(organizationId: string, name: string) {
  return withServerActionGuard("organization.updateDisplayName", async () => {
  if (!assertUuid(organizationId)) {
    return { error: "Gecersiz organizasyon kimligi." };
  }

  const trimmed = name.trim();
  if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) {
    return { error: `Organizasyon adi ${NAME_MIN}-${NAME_MAX} karakter olmalidir.` };
  }

  const schemaError = await assertCriticalSchemaReady(["organization_lifecycle"]);
  if (schemaError) return { error: schemaError };

  const sessionClient = await createServerSupabaseClient();
  const { data: authData } = await sessionClient.auth.getUser();
  if (!authData.user) return { error: "Gecersiz oturum." };

  let { data: actor } = await sessionClient
    .from("profiles")
    .select("role, organization_id")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (!actor) {
    const adminClient = createSupabaseAdminClient();
    const byId = await adminClient
      .from("profiles")
      .select("role, organization_id")
      .eq("id", authData.user.id)
      .maybeSingle();
    actor = byId.data ?? null;
    if (!actor) {
      actor = {
        role: extractSessionRole(authData.user),
        organization_id: extractSessionOrganizationId(authData.user),
      };
    }
  }

  const role = getSafeRole(actor?.role);
  if (role === "super_admin") {
    /* any org */
  } else if (role === "admin" && actor?.organization_id === organizationId) {
    /* own org */
  } else {
    return { error: "Bu islem icin yetkiniz yok." };
  }

  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient.from("organizations").update({ name: trimmed }).eq("id", organizationId);
  if (error) return { error: `Guncellenemedi: ${error.message}` };

  revalidatePath("/");
  revalidatePath("/super-admin");
  revalidatePath(`/super-admin/${organizationId}`);
  return { success: true as const };
  });
}

/**
 * Organizasyonun saat dilimini günceller (IANA tz, ör. "Europe/Istanbul", "Europe/Berlin", "UTC").
 *
 * - Yetki: organizasyonun kendi admin'i veya super_admin
 * - Validation: client + server tarafında IANA tz pattern + Intl.DateTimeFormat denenir
 * - Etki: bir sonraki Performance/Finans dönem sorgusunda yeni TZ aktif olur (resolver cache 60s)
 */
export async function updateOrganizationTimeZoneAction(organizationId: string, timeZone: string) {
  return withServerActionGuard("organization.updateTimeZone", async () => {
    const tzInput = String(timeZone || "").trim();
    if (!tzInput) return { error: "Saat dilimi boş olamaz." };
    if (!isLikelyIanaTimeZone(tzInput)) {
      return { error: "Geçersiz saat dilimi (IANA bölge formatında olmalı, ör. Europe/Istanbul)." };
    }

    const actor = await resolveOrganizationActor(organizationId);
    if ("error" in actor) return { error: actor.error };

    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient
      .from("organizations")
      .update({ time_zone: tzInput })
      .eq("id", organizationId);
    if (error) return { error: `Saat dilimi güncellenemedi: ${error.message}` };

    // Bu process'teki TZ resolver cache'ini hemen temizle ki sonraki istekler
    // 60sn TTL beklemeden yeni değeri görsün. Yatay ölçekte (birden fazla node)
    // her node kendi memory cache'ini taşır; revalidatePath ile bir sonraki
    // istek zaten DB'den taze TZ okur (her node ilk istekte cache'i tazeler).
    invalidateOrganizationTimeZoneCache(organizationId);

    revalidatePath("/");
    revalidatePath("/performans");
    revalidatePath("/tahsilat-merkezi");
    revalidatePath("/muhasebe-finans");
    revalidatePath("/finans");
    revalidatePath("/haftalik-ders-programi");
    revalidatePath("/super-admin");
    revalidatePath(`/super-admin/${organizationId}`);
    return { success: true as const, timeZone: tzInput };
  });
}
