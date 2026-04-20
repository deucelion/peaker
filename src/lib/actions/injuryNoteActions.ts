"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getCoachPermissions } from "@/lib/auth/coachPermissions";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { messageIfAthleteCannotOperate } from "@/lib/athlete/lifecycle";
import { messageIfCoachCannotOperate } from "@/lib/coach/lifecycle";
import { isUuid } from "@/lib/validation/uuid";
import { toDisplayName } from "@/lib/profile/displayName";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import type { AthleteInjuryNoteRecord, InjuryNoteAsset } from "@/lib/types";

const INJURY_BUCKET = "injury-note-assets";
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_IMAGES_PER_NOTE = 5;
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

function assertUuid(id: string | null | undefined): id is string {
  return isUuid(id);
}

function normalizeText(value: string | null | undefined, maxLen: number) {
  return (value || "").trim().slice(0, maxLen);
}

function extFromMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

async function resolveManagementActor(requireMutation: boolean) {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: true });
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;

  if (!actor.organizationId) return { error: "Organizasyon bilgisi eksik." as const };
  if (actor.role !== "admin" && actor.role !== "coach") return { error: "Bu islem icin yetkiniz yok." as const };
  if (actor.role === "coach") {
    const block = messageIfCoachCannotOperate(actor.role, actor.isActive);
    if (block) return { error: block };
    const perms = await getCoachPermissions(actor.id, actor.organizationId);
    if (!perms.can_view_all_athletes) return { error: "Sporcu kayitlarini goruntuleme yetkiniz yok." as const };
    if (requireMutation && !perms.can_manage_athlete_profiles) {
      return { error: "Sakatlik kaydi duzenleme yetkiniz yok." as const };
    }
  }
  return { actor };
}

async function assertAthleteInActorOrg(organizationId: string, athleteId: string) {
  const adminClient = createSupabaseAdminClient();
  const { data: target, error } = await adminClient
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", athleteId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !target || getSafeRole(target.role) !== "sporcu") {
    return { error: "Sporcu bulunamadi veya organizasyon disi." as const };
  }
  return { target };
}

async function signInjuryAssets(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  paths: string[]
): Promise<InjuryNoteAsset[]> {
  if (!Array.isArray(paths) || paths.length === 0) return [];
  const signed = await Promise.all(
    paths.map(async (path) => {
      const safePath = (path || "").trim();
      if (!safePath) return null;
      const { data, error } = await adminClient.storage.from(INJURY_BUCKET).createSignedUrl(safePath, SIGNED_URL_TTL_SECONDS);
      if (error || !data?.signedUrl) return null;
      return { path: safePath, signedUrl: data.signedUrl } as InjuryNoteAsset;
    })
  );
  return signed.filter((row): row is InjuryNoteAsset => Boolean(row));
}

async function mapRowsToRecords(
  rows: Array<{
    id: string;
    organization_id: string;
    athlete_id: string;
    created_by: string;
    injury_type: string;
    note: string;
    image_paths: string[] | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }>
) {
  const adminClient = createSupabaseAdminClient();
  const creatorIds = Array.from(new Set(rows.map((r) => r.created_by).filter(Boolean)));
  let creatorMap = new Map<string, string>();
  if (creatorIds.length > 0) {
    const { data: creators } = await adminClient
      .from("profiles")
      .select("id, full_name, email")
      .in("id", creatorIds);
    creatorMap = new Map(
      (creators || []).map((c) => [c.id, toDisplayName(c.full_name ?? null, c.email ?? null, "Antrenor")])
    );
  }

  const mapped = await Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      organizationId: row.organization_id,
      athleteId: row.athlete_id,
      createdBy: row.created_by,
      createdByName: creatorMap.get(row.created_by) || "Antrenor",
      injuryType: row.injury_type,
      note: row.note,
      assets: await signInjuryAssets(adminClient, row.image_paths || []),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  );
  return mapped as AthleteInjuryNoteRecord[];
}

type InjuryNoteTableRow = {
  id: string;
  organization_id: string;
  athlete_id: string;
  created_by: string;
  injury_type: string;
  note: string;
  image_paths: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export async function listAthleteInjuryNotesForManagement(athleteId: string) {
  if (!assertUuid(athleteId)) return { error: "Gecersiz sporcu kimligi." as const };
  const resolved = await resolveManagementActor(false);
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;

  const targetCheck = await assertAthleteInActorOrg(actor.organizationId!, athleteId);
  if ("error" in targetCheck) return { error: targetCheck.error };

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("athlete_injury_notes")
    .select("id, organization_id, athlete_id, created_by, injury_type, note, image_paths, is_active, created_at, updated_at")
    .eq("organization_id", actor.organizationId)
    .eq("athlete_id", athleteId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) return { error: `Sakatlik gecmisi alinamadi: ${error.message}` };

  const records = await mapRowsToRecords((data || []) as InjuryNoteTableRow[]);
  return { notes: records };
}

export async function listMyAthleteInjuryNotes() {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: true });
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  if (!actor.organizationId) return { error: "Organizasyon bilgisi eksik." };
  if (actor.role !== "sporcu") return { error: "Bu sayfa yalnizca sporcular icindir." };
  const block = messageIfAthleteCannotOperate(actor.role, actor.isActive);
  if (block) return { error: block };

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("athlete_injury_notes")
    .select("id, organization_id, athlete_id, created_by, injury_type, note, image_paths, is_active, created_at, updated_at")
    .eq("organization_id", actor.organizationId)
    .eq("athlete_id", actor.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) return { error: `Sakatlik gecmisi alinamadi: ${error.message}` };

  const records = await mapRowsToRecords((data || []) as InjuryNoteTableRow[]);
  return { notes: records };
}

export async function createAthleteInjuryNote(formData: FormData) {
  const athleteId = formData.get("athleteId")?.toString() || "";
  if (!assertUuid(athleteId)) return { error: "Gecersiz sporcu kimligi." as const };

  const resolved = await resolveManagementActor(true);
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;

  const targetCheck = await assertAthleteInActorOrg(actor.organizationId!, athleteId);
  if ("error" in targetCheck) return { error: targetCheck.error };

  const injuryType = normalizeText(formData.get("injuryType")?.toString(), 80);
  const note = normalizeText(formData.get("note")?.toString(), 1000);
  if (!injuryType) return { error: "Sakatlik turu zorunludur." as const };
  if (!note) return { error: "Sakatlik notu zorunludur." as const };

  const imageFiles = formData
    .getAll("images")
    .filter((file): file is File => file instanceof File && file.size > 0);

  if (imageFiles.length > MAX_IMAGES_PER_NOTE) {
    return { error: `Bir kayit icin en fazla ${MAX_IMAGES_PER_NOTE} gorsel yuklenebilir.` as const };
  }

  const noteId = crypto.randomUUID();
  const uploadedPaths: string[] = [];
  const adminClient = createSupabaseAdminClient();

  for (const file of imageFiles) {
    if (file.size > MAX_IMAGE_BYTES) {
      return { error: "Her gorsel en fazla 6 MB olabilir." as const };
    }
    const mime = (file.type || "").toLowerCase();
    if (!ALLOWED_IMAGE_MIME.includes(mime as (typeof ALLOWED_IMAGE_MIME)[number])) {
      return { error: "Yalnizca JPEG, PNG, WebP veya GIF gorseller yuklenebilir." as const };
    }

    const ext = extFromMime(mime);
    const objectPath = `injury-notes/${actor.organizationId}/${athleteId}/${noteId}/${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadErr } = await adminClient.storage.from(INJURY_BUCKET).upload(objectPath, buffer, {
      contentType: mime,
      upsert: false,
    });
    if (uploadErr) {
      return { error: `Gorsel yuklenemedi: ${uploadErr.message}` as const };
    }
    uploadedPaths.push(objectPath);
  }

  const { error } = await adminClient.from("athlete_injury_notes").insert({
    id: noteId,
    organization_id: actor.organizationId,
    athlete_id: athleteId,
    created_by: actor.id,
    injury_type: injuryType,
    note,
    image_paths: uploadedPaths,
    is_active: true,
  });
  if (error) {
    if (uploadedPaths.length > 0) {
      await adminClient.storage.from(INJURY_BUCKET).remove(uploadedPaths);
    }
    return { error: `Sakatlik kaydi olusturulamadi: ${error.message}` as const };
  }

  await logAuditEvent({
    organizationId: actor.organizationId!,
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "athlete.lifecycle.update",
    entityType: "athlete",
    entityId: athleteId,
    metadata: { injuryNoteId: noteId, injuryNoteAction: "create", imageCount: uploadedPaths.length },
  });

  revalidatePath(`/sporcu/${athleteId}`);
  revalidatePath("/sporcu");
  return { success: true as const };
}

export async function updateAthleteInjuryNote(
  noteId: string,
  updates: { injuryType: string; note: string }
) {
  if (!assertUuid(noteId)) return { error: "Gecersiz sakatlik kaydi kimligi." as const };
  const resolved = await resolveManagementActor(true);
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;

  const injuryType = normalizeText(updates.injuryType, 80);
  const note = normalizeText(updates.note, 1000);
  if (!injuryType) return { error: "Sakatlik turu zorunludur." as const };
  if (!note) return { error: "Sakatlik notu zorunludur." as const };

  const adminClient = createSupabaseAdminClient();
  const { data: existing, error: existingErr } = await adminClient
    .from("athlete_injury_notes")
    .select("id, organization_id, athlete_id")
    .eq("id", noteId)
    .eq("organization_id", actor.organizationId)
    .maybeSingle();
  if (existingErr || !existing) return { error: "Sakatlik kaydi bulunamadi." as const };

  const { error } = await adminClient
    .from("athlete_injury_notes")
    .update({ injury_type: injuryType, note, updated_at: new Date().toISOString() })
    .eq("id", noteId)
    .eq("organization_id", actor.organizationId);
  if (error) return { error: `Sakatlik kaydi guncellenemedi: ${error.message}` as const };

  await logAuditEvent({
    organizationId: actor.organizationId!,
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "athlete.lifecycle.update",
    entityType: "athlete",
    entityId: existing.athlete_id,
    metadata: { injuryNoteId: noteId, injuryNoteAction: "update" },
  });

  revalidatePath(`/sporcu/${existing.athlete_id}`);
  revalidatePath("/sporcu");
  return { success: true as const };
}

export async function deactivateAthleteInjuryNote(noteId: string) {
  if (!assertUuid(noteId)) return { error: "Gecersiz sakatlik kaydi kimligi." as const };
  const resolved = await resolveManagementActor(true);
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;

  const adminClient = createSupabaseAdminClient();
  const { data: existing, error: existingErr } = await adminClient
    .from("athlete_injury_notes")
    .select("id, organization_id, athlete_id, image_paths")
    .eq("id", noteId)
    .eq("organization_id", actor.organizationId)
    .maybeSingle();
  if (existingErr || !existing) return { error: "Sakatlik kaydi bulunamadi." as const };

  const { error } = await adminClient
    .from("athlete_injury_notes")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", noteId)
    .eq("organization_id", actor.organizationId);
  if (error) return { error: `Sakatlik kaydi pasife alinamadi: ${error.message}` as const };

  await logAuditEvent({
    organizationId: actor.organizationId!,
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "athlete.lifecycle.update",
    entityType: "athlete",
    entityId: existing.athlete_id,
    metadata: { injuryNoteId: noteId, injuryNoteAction: "deactivate", imageCount: (existing.image_paths || []).length },
  });

  revalidatePath(`/sporcu/${existing.athlete_id}`);
  revalidatePath("/sporcu");
  return { success: true as const };
}
