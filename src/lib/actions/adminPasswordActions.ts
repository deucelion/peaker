"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { isUuid } from "@/lib/validation/uuid";
import { withServerActionGuard } from "@/lib/observability/serverActionError";
import {
  assertAdminCanSetUserPassword,
  auditEntityForPasswordReset,
  type PasswordAdminActor,
} from "@/lib/auth/adminPasswordPolicy";
import { mapAuthPasswordError, readPasswordInput, validatePasswordMinLength } from "@/lib/auth/passwordInput";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";

function assertUuid(id: string | null | undefined): id is string {
  return isUuid(id);
}

async function resolvePasswordAdminActor(): Promise<PasswordAdminActor | { error: string }> {
  const result = await resolveSessionActor();
  if ("error" in result) {
    return { error: result.error === "Profil dogrulanamadi." ? "Kullanıcı profili doğrulanamadı." : result.error };
  }

  const { actor } = result;
  if (actor.role === "super_admin") {
    return { kind: "super_admin", actorId: actor.id, actorRole: actor.role };
  }
  if (actor.role === "admin" && actor.organizationId) {
    return {
      kind: "admin",
      actorId: actor.id,
      actorRole: actor.role,
      organizationId: actor.organizationId,
    };
  }
  return { error: "Bu işlem yalnızca organizasyon admini veya super admin içindir." };
}

/** Org admin: kendi orgundaki koc/sporcu. Super admin: tum orglardaki tum roller (super_admin dahil). */
export async function setUserPasswordByAdmin(targetUserId: string, newPassword: string) {
  return withServerActionGuard("admin.setUserPasswordByAdmin", async () => {
    if (!assertUuid(targetUserId)) return { error: "Gecersiz kullanici kimligi." };

    const password = readPasswordInput(newPassword);
    const passwordIssue = validatePasswordMinLength(password);
    if (passwordIssue) return { error: passwordIssue };

    const actor = await resolvePasswordAdminActor();
    if ("error" in actor) return { error: actor.error };

    const adminClient = createSupabaseAdminClient();
    const { data: target, error: fetchErr } = await adminClient
      .from("profiles")
      .select("id, role, organization_id, email, full_name")
      .eq("id", targetUserId)
      .maybeSingle();

    if (fetchErr || !target) return { error: "Kullanici bulunamadi." };

    const policyError = assertAdminCanSetUserPassword(actor, target);
    if (policyError) return { error: policyError };

    const targetRole = getSafeRole(target.role);
    if (!targetRole) return { error: "Gecersiz hedef kullanici rolu." };

    const { error: authErr } = await adminClient.auth.admin.updateUserById(targetUserId, { password });
    if (authErr) return { error: mapAuthPasswordError(authErr.message) };

    const audit = auditEntityForPasswordReset(targetRole);
    const organizationId = target.organization_id ?? (actor.kind === "admin" ? actor.organizationId : null);

    if (organizationId) {
      await logAuditEvent({
        organizationId,
        actorUserId: actor.actorId,
        actorRole: actor.actorRole,
        action: audit.action,
        entityType: audit.entityType,
        entityId: audit.entityType === "organization" ? organizationId : targetUserId,
        metadata: {
          passwordSetByAdmin: true,
          targetRole: target.role,
          targetUserId,
        },
      });
    }

    revalidatePath("/koclar");
    revalidatePath(`/koclar/${targetUserId}`);
    revalidatePath("/oyuncular");
    revalidatePath(`/sporcu/${targetUserId}`);
    revalidatePath("/super-admin");
    if (organizationId) {
      revalidatePath(`/super-admin/${organizationId}`);
    }

    return { success: true as const };
  });
}

/** Super admin ayarlar / hub: sifre atamasi icin org listesi. */
export async function listOrganizationsForSuperAdminPasswordHub() {
  return withServerActionGuard("admin.listOrganizationsForSuperAdminPasswordHub", async () => {
    const actorResult = await resolveSessionActor();
    if ("error" in actorResult) return { error: actorResult.error };
    if (actorResult.actor.role !== "super_admin") {
      return { error: "Bu işlem yalnızca super admin içindir." };
    }

    const adminClient = createSupabaseAdminClient();
    const { data, error } = await adminClient
      .from("organizations")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) return { error: `Organizasyon listesi alinamadi: ${error.message}` };
    return { organizations: data || [] };
  });
}
