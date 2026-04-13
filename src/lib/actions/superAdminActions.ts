"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createServerSupabaseClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { extractSessionRole } from "@/lib/auth/sessionClaims";
import { assertCriticalSchemaReady } from "@/lib/diagnostics/systemHealth";
import { isMissingOrganizationLifecycleColumnError } from "@/lib/organization/adminOrganizationQuery";
import {
  assertEndsNotBeforeStart,
  parseOptionalIsoDateField,
} from "@/lib/organization/license";
import {
  assertLifecycleTransition,
  type LifecycleAction,
  ORGANIZATION_STATUSES,
  parseOrganizationStatus,
  type OrganizationStatus,
} from "@/lib/organization/lifecycle";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { runProfileIntegrityRepair } from "@/lib/diagnostics/profileIntegrity";
import { isUuid } from "@/lib/validation/uuid";
import { normalizeEmailInput, SIMPLE_EMAIL_RE } from "@/lib/email/emailNormalize";
import { captureServerActionError, withServerActionGuard } from "@/lib/observability/serverActionError";

function assertOrganizationId(id: string | null | undefined): id is string {
  return isUuid(id);
}

async function assertSuperAdmin() {
  const sessionClient = await createServerSupabaseClient();
  const { data: authData } = await sessionClient.auth.getUser();
  if (!authData.user) return { error: "Gecersiz oturum." as const };

  let actor =
    (await sessionClient.from("profiles").select("id, role").eq("id", authData.user.id).maybeSingle()).data ?? null;

  // /sistem-saglik ile ayni: session RLS ile profil bos donerse admin okumasi (super_admin repair reddi onlenir).
  if (!actor) {
    try {
      const adminClient = createSupabaseAdminClient();
      const { data } = await adminClient.from("profiles").select("id, role").eq("id", authData.user.id).maybeSingle();
      actor = data ?? null;
    } catch {
      // SUPABASE_SERVICE_ROLE_KEY yok veya admin istemci olusmadi
    }
  }

  const sessionRole = getSafeRole(extractSessionRole(authData.user));
  const profileRole = getSafeRole(actor?.role);
  const isSuperAdmin = profileRole === "super_admin" || sessionRole === "super_admin";
  if (!isSuperAdmin) {
    return { error: "Bu islem sadece super admin icindir." as const };
  }
  return {
    actor: {
      id: actor?.id ?? authData.user.id,
      role: actor?.role ?? "super_admin",
    },
  };
}

async function requireOrganizationLifecycleSchema() {
  const schemaError = await assertCriticalSchemaReady(["organization_lifecycle"]);
  if (schemaError) return { error: schemaError };
  return {};
}

export async function createOrganizationWithAdmin(formData: FormData) {
  return withServerActionGuard("superAdmin.createOrganizationWithAdmin", async () => {
  const orgName = formData.get("organizationName")?.toString().trim();
  const adminEmail = normalizeEmailInput(formData.get("adminEmail")?.toString());
  const adminFullName = formData.get("adminFullName")?.toString().trim() || "Organization Admin";
  const tempPassword = formData.get("tempPassword")?.toString().trim();

  if (!orgName || !adminEmail || !SIMPLE_EMAIL_RE.test(adminEmail) || !tempPassword || tempPassword.length < 6) {
    return { error: "Organizasyon adi, gecerli admin e-postasi ve en az 6 karakter sifre zorunludur." };
  }

  const guard = await assertSuperAdmin();
  if ("error" in guard) return { error: guard.error ?? "Yetkisiz" };

  const schemaGuard = await requireOrganizationLifecycleSchema();
  if ("error" in schemaGuard) return { error: schemaGuard.error ?? "Sema dogrulamasi basarisiz." };

  const adminClient = createSupabaseAdminClient();

  const nowIso = new Date().toISOString();
  const { data: orgInsert, error: orgError } = await adminClient
    .from("organizations")
    .insert({
      name: orgName,
      status: "active",
      starts_at: nowIso,
    })
    .select("id, name")
    .single();

  if (orgError || !orgInsert) return { error: `Organizasyon olusturulamadi: ${orgError?.message}` };

  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email: adminEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: adminFullName,
      role: "admin",
      organization_id: orgInsert.id,
      force_password_change: true,
    },
  });
  if (authError || !authUser.user) {
    await adminClient.from("organizations").delete().eq("id", orgInsert.id);
    return { error: `Admin hesabi olusturulamadi: ${authError?.message}` };
  }

  const { error: profileError } = await adminClient.from("profiles").insert({
    id: authUser.user.id,
    full_name: adminFullName,
    email: adminEmail,
    role: "admin",
    organization_id: orgInsert.id,
    is_active: true,
    created_at: new Date().toISOString(),
  });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(authUser.user.id);
    await adminClient.from("organizations").delete().eq("id", orgInsert.id);
    return { error: `Admin profil olusturulamadi: ${profileError.message}` };
  }

  revalidatePath("/super-admin");
  await logAuditEvent({
    organizationId: orgInsert.id,
    actorUserId: guard.actor.id,
    actorRole: guard.actor.role,
    action: "organization.create",
    entityType: "organization",
    entityId: orgInsert.id,
  });
  return { success: true, organizationId: orgInsert.id };
  });
}

async function loadOrganizationStatusForSuperAdmin(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  organizationId: string
): Promise<{ ok: true; status: OrganizationStatus } | { ok: false; error: string }> {
  const { data, error } = await adminClient
    .from("organizations")
    .select("status")
    .eq("id", organizationId)
    .maybeSingle();
  if (error && isMissingOrganizationLifecycleColumnError(error.message)) {
    return {
      ok: false,
      error:
        "Veritabaninda lifecycle kolonlari yok. Supabase migration (20260403_organization_lifecycle.sql) uygulayin.",
    };
  }
  if (error || !data) {
    return { ok: false, error: "Organizasyon bulunamadi veya okunamadi." };
  }
  return { ok: true, status: parseOrganizationStatus((data as { status?: string | null }).status) };
}

async function runLifecycleUpdate(
  organizationId: string,
  action: LifecycleAction
): Promise<{ success: true } | { error: string }> {
  return withServerActionGuard("superAdmin.runLifecycleUpdate", async () => {
  if (!assertOrganizationId(organizationId)) {
    return { error: "Gecersiz organizasyon kimligi." };
  }

  const guard = await assertSuperAdmin();
  if ("error" in guard) return { error: guard.error ?? "Yetkisiz" };

  const schemaGuard = await requireOrganizationLifecycleSchema();
  if ("error" in schemaGuard) return { error: schemaGuard.error ?? "Sema dogrulamasi basarisiz." };

  const adminClient = createSupabaseAdminClient();
  const current = await loadOrganizationStatusForSuperAdmin(adminClient, organizationId);
  if (!current.ok) return { error: current.error };

  const transition = assertLifecycleTransition(action, current.status);
  if (!transition.ok) return { error: transition.message };

  const { error: updateError } = await adminClient
    .from("organizations")
    .update({ status: transition.next })
    .eq("id", organizationId);

  if (updateError) {
    if (isMissingOrganizationLifecycleColumnError(updateError.message)) {
      return {
        error:
          "Veritabaninda lifecycle kolonlari yok. Supabase migration (20260403_organization_lifecycle.sql) uygulayin.",
      };
    }
    return { error: `Guncellenemedi: ${updateError.message}` };
  }

  revalidatePath("/super-admin");
  revalidatePath(`/super-admin/${organizationId}`);
  await logAuditEvent({
    organizationId,
    actorUserId: guard.actor.id,
    actorRole: guard.actor.role,
    action: "organization.lifecycle.update",
    entityType: "organization",
    entityId: organizationId,
    metadata: { lifecycleAction: action, nextStatus: transition.next },
  });
  return { success: true };
  });
}

export async function suspendOrganizationAction(organizationId: string) {
  return runLifecycleUpdate(organizationId, "suspend");
}

export async function reactivateOrganizationAction(organizationId: string) {
  return runLifecycleUpdate(organizationId, "reactivate");
}

export async function archiveOrganizationAction(organizationId: string) {
  return runLifecycleUpdate(organizationId, "archive");
}

export async function updateOrganizationLicenseDatesAction(
  organizationId: string,
  payload: { startsAt: string | null | undefined; endsAt: string | null | undefined }
) {
  return withServerActionGuard("superAdmin.updateOrganizationLicenseDates", async () => {
  if (!assertOrganizationId(organizationId)) {
    return { error: "Gecersiz organizasyon kimligi." };
  }

  const guard = await assertSuperAdmin();
  if ("error" in guard) return { error: guard.error ?? "Yetkisiz" };

  const schemaGuard = await requireOrganizationLifecycleSchema();
  if ("error" in schemaGuard) return { error: schemaGuard.error ?? "Sema dogrulamasi basarisiz." };

  const startsParsed = parseOptionalIsoDateField(payload.startsAt);
  if (!startsParsed.ok) return { error: startsParsed.error };
  const endsParsed = parseOptionalIsoDateField(payload.endsAt);
  if (!endsParsed.ok) return { error: endsParsed.error };

  const range = assertEndsNotBeforeStart(startsParsed.value, endsParsed.value);
  if (!range.ok) return { error: range.error };

  const adminClient = createSupabaseAdminClient();
  const { error: updateError } = await adminClient
    .from("organizations")
    .update({
      starts_at: startsParsed.value,
      ends_at: endsParsed.value,
    })
    .eq("id", organizationId);

  if (updateError) {
    if (isMissingOrganizationLifecycleColumnError(updateError.message)) {
      return {
        error:
          "Veritabaninda lifecycle kolonlari yok. Supabase migration (20260403_organization_lifecycle.sql) uygulayin.",
      };
    }
    return { error: `Guncellenemedi: ${updateError.message}` };
  }

  revalidatePath("/super-admin");
  revalidatePath(`/super-admin/${organizationId}`);
  await logAuditEvent({
    organizationId,
    actorUserId: guard.actor.id,
    actorRole: guard.actor.role,
    action: "organization.license.update",
    entityType: "organization",
    entityId: organizationId,
    metadata: { startsAt: startsParsed.value, endsAt: endsParsed.value },
  });
  return { success: true as const };
  });
}

export async function superAdminSetOrganizationStatusAction(organizationId: string, nextStatusRaw: string) {
  return withServerActionGuard("superAdmin.setOrganizationStatus", async () => {
  if (!assertOrganizationId(organizationId)) {
    return { error: "Gecersiz organizasyon kimligi." };
  }

  const guard = await assertSuperAdmin();
  if ("error" in guard) return { error: guard.error ?? "Yetkisiz" };

  const schemaGuard = await requireOrganizationLifecycleSchema();
  if ("error" in schemaGuard) return { error: schemaGuard.error ?? "Sema dogrulamasi basarisiz." };

  const trimmed = nextStatusRaw?.trim().toLowerCase();
  if (!trimmed || !(ORGANIZATION_STATUSES as readonly string[]).includes(trimmed)) {
    return { error: "Gecersiz organizasyon statüsü." };
  }
  const nextStatus = trimmed as OrganizationStatus;

  const adminClient = createSupabaseAdminClient();
  const { error: updateError } = await adminClient.from("organizations").update({ status: nextStatus }).eq("id", organizationId);

  if (updateError) {
    if (isMissingOrganizationLifecycleColumnError(updateError.message)) {
      return {
        error:
          "Veritabaninda lifecycle kolonlari yok. Supabase migration (20260403_organization_lifecycle.sql) uygulayin.",
      };
    }
    return { error: `Guncellenemedi: ${updateError.message}` };
  }

  revalidatePath("/super-admin");
  revalidatePath(`/super-admin/${organizationId}`);
  await logAuditEvent({
    organizationId,
    actorUserId: guard.actor.id,
    actorRole: guard.actor.role,
    action: "organization.lifecycle.update",
    entityType: "organization",
    entityId: organizationId,
    metadata: { nextStatus },
  });
  return { success: true as const };
  });
}

export async function runProfileIntegrityRepairAction(options?: { dryRun?: boolean }) {
  const guard = await assertSuperAdmin();
  if ("error" in guard) return { error: guard.error ?? "Yetkisiz" };

  try {
    const dryRun = options?.dryRun !== false;
    const result = await runProfileIntegrityRepair(dryRun);
    revalidatePath("/sistem-saglik");
    revalidateTag("system-health-report", "max");
    return { success: true as const, result };
  } catch (error: unknown) {
    captureServerActionError("superAdmin.runProfileIntegrityRepair", error);
    const message = error instanceof Error ? error.message : "Profile integrity repair basarisiz.";
    return { error: message };
  }
}
