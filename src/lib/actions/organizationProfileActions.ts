"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { assertCriticalSchemaReady } from "@/lib/diagnostics/systemHealth";
import { extractSessionOrganizationId, extractSessionRole } from "@/lib/auth/sessionClaims";
import { isUuid } from "@/lib/validation/uuid";
import { withServerActionGuard } from "@/lib/observability/serverActionError";

const NAME_MIN = 2;
const NAME_MAX = 120;

function assertUuid(id: string | null | undefined): id is string {
  return isUuid(id);
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
