"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { isUuid } from "@/lib/validation/uuid";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { appendPrivateLessonPackageEvent } from "@/lib/privateLessons/appendPrivateLessonPackageEvent";
import { appendOperationalTimeline } from "@/lib/operational/timeline";
import { withServerActionGuard } from "@/lib/observability/serverActionError";

export type FinanceContactMethod = "phone" | "whatsapp" | "in_person" | "other";

export type FinanceContactNoteRow = {
  id: string;
  organizationId: string;
  athleteId: string;
  packageId: string | null;
  note: string;
  contactMethod: FinanceContactMethod;
  followUpDate: string | null;
  createdBy: string | null;
  createdAt: string;
};

function mapMethod(raw: string): FinanceContactMethod {
  if (raw === "phone" || raw === "whatsapp" || raw === "in_person" || raw === "other") return raw;
  return "other";
}

export async function createFinanceContactNote(formData: FormData) {
  return withServerActionGuard("financeNote.createFinanceContactNote", async () => {
    const resolved = await resolveSessionActor({ claimRequiresOrganization: true });
    if ("error" in resolved) return { error: resolved.error };
    const actor = resolved.actor;
    const role = getSafeRole(actor.role);
    if (role !== "admin" && role !== "coach") return { error: "Bu işlem için yetkiniz yok." };
    const organizationId = actor.organizationId || "";
    if (!organizationId) return { error: "Organizasyon bilgisi eksik." };

    const athleteId = formData.get("athleteId")?.toString().trim() || "";
    const packageIdRaw = formData.get("packageId")?.toString().trim() || "";
    const note = formData.get("note")?.toString().trim() || "";
    const contactMethod = mapMethod(formData.get("contactMethod")?.toString().trim() || "other");
    const followUpRaw = formData.get("followUpDate")?.toString().trim() || "";
    const followUpDate = followUpRaw && /^\d{4}-\d{2}-\d{2}$/.test(followUpRaw) ? followUpRaw : null;

    if (!isUuid(athleteId)) return { error: "Geçersiz sporcu." };
    if (note.length < 2) return { error: "Not en az 2 karakter olmalıdır." };
    if (note.length > 4000) return { error: "Not çok uzun." };

    const packageId = packageIdRaw && isUuid(packageIdRaw) ? packageIdRaw : null;

    const adminClient = createSupabaseAdminClient();
    const { data: athlete } = await adminClient
      .from("profiles")
      .select("id, role, organization_id")
      .eq("id", athleteId)
      .maybeSingle();
    if (!athlete || getSafeRole(athlete.role) !== "sporcu" || athlete.organization_id !== organizationId) {
      return { error: "Sporcu bulunamadı." };
    }

    if (packageId) {
      const { data: pkg } = await adminClient
        .from("private_lesson_packages")
        .select("id, organization_id, athlete_id")
        .eq("id", packageId)
        .maybeSingle();
      if (!pkg || pkg.organization_id !== organizationId || pkg.athlete_id !== athleteId) {
        return { error: "Paket bu sporcuya ait değil." };
      }
    }

    const { data: inserted, error } = await adminClient
      .from("finance_contact_notes")
      .insert({
        organization_id: organizationId,
        athlete_id: athleteId,
        package_id: packageId,
        note,
        contact_method: contactMethod,
        follow_up_date: followUpDate,
        created_by: actor.id,
      })
      .select("id")
      .single();

    if (error || !inserted?.id) return { error: `Not kaydedilemedi: ${error?.message || "bilinmeyen"}` };
    const noteId = inserted.id as string;

    try {
      await logAuditEvent({
        organizationId,
        actorUserId: actor.id,
        actorRole: actor.role,
        action: "finance_note.create",
        entityType: "finance_contact_note",
        entityId: noteId,
        metadata: { athleteId, packageId, contactMethod },
      });
    } catch {
      /* best-effort */
    }

    await appendOperationalTimeline(adminClient, {
      organizationId,
      eventType: "finance_note.created",
      summary: "Finans görüşme notu eklendi",
      payload: { noteId, athleteId, packageId },
      actorUserId: actor.id,
    });

    if (packageId) {
      await appendPrivateLessonPackageEvent(adminClient, {
        packageId,
        organizationId,
        actorId: actor.id,
        eventType: "finance_note_added",
        title: "Finans notu",
        description: note.slice(0, 500),
        metadata: { noteId, contactMethod },
      });
    }

    revalidatePath("/muhasebe-finans");
    revalidatePath("/sporcu");
    revalidatePath(`/sporcu/${athleteId}`);
    if (packageId) revalidatePath(`/ozel-ders-paketleri/${packageId}`);
    return { success: true as const, noteId };
  });
}

export async function listFinanceContactNotesForAthlete(athleteId: string, packageId?: string | null) {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: true });
  if ("error" in resolved) return { error: resolved.error };
  const actor = resolved.actor;
  const role = getSafeRole(actor.role);
  if (role !== "admin" && role !== "coach" && role !== "sporcu") return { error: "Yetkisiz." };
  const organizationId = actor.organizationId || "";
  if (!organizationId) return { error: "Organizasyon eksik." };
  const aid = athleteId?.trim() || "";
  if (!isUuid(aid)) return { error: "Geçersiz sporcu." };
  if (role === "sporcu" && actor.id !== aid) return { error: "Sadece kendi notlarınızı görebilirsiniz." };

  const adminClient = createSupabaseAdminClient();
  let q = adminClient
    .from("finance_contact_notes")
    .select("id, organization_id, athlete_id, package_id, note, contact_method, follow_up_date, created_by, created_at")
    .eq("organization_id", organizationId)
    .eq("athlete_id", aid)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(80);
  if (packageId && isUuid(packageId)) q = q.eq("package_id", packageId);

  const { data, error } = await q;
  if (error) return { error: error.message };
  const rows: FinanceContactNoteRow[] = (data || []).map((r) => ({
    id: r.id as string,
    organizationId: r.organization_id as string,
    athleteId: r.athlete_id as string,
    packageId: (r.package_id as string | null) ?? null,
    note: r.note as string,
    contactMethod: mapMethod(String(r.contact_method)),
    followUpDate: (r.follow_up_date as string | null) ?? null,
    createdBy: (r.created_by as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
  return { notes: rows };
}

export async function softDeleteFinanceContactNote(noteId: string) {
  return withServerActionGuard("financeNote.softDeleteFinanceContactNote", async () => {
    const resolved = await resolveSessionActor({ claimRequiresOrganization: true });
    if ("error" in resolved) return { error: resolved.error };
    const actor = resolved.actor;
    const role = getSafeRole(actor.role);
    if (role !== "admin") return { error: "Not silme yalnızca yönetici içindir." };
    const organizationId = actor.organizationId || "";
    if (!isUuid(noteId)) return { error: "Geçersiz not." };

    const adminClient = createSupabaseAdminClient();
    const { data: row } = await adminClient
      .from("finance_contact_notes")
      .select("id, athlete_id, package_id")
      .eq("id", noteId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!row) return { error: "Not bulunamadı." };

    const { error } = await adminClient
      .from("finance_contact_notes")
      .update({ deleted_at: new Date().toISOString(), deleted_by: actor.id })
      .eq("id", noteId)
      .eq("organization_id", organizationId);
    if (error) return { error: error.message };

    try {
      await logAuditEvent({
        organizationId,
        actorUserId: actor.id,
        actorRole: actor.role,
        action: "finance_note.delete",
        entityType: "finance_contact_note",
        entityId: noteId,
        metadata: { athleteId: row.athlete_id, packageId: row.package_id },
      });
    } catch {
      /* best-effort */
    }

    revalidatePath("/muhasebe-finans");
    revalidatePath(`/sporcu/${row.athlete_id}`);
    if (row.package_id) revalidatePath(`/ozel-ders-paketleri/${row.package_id}`);
    return { success: true as const };
  });
}
