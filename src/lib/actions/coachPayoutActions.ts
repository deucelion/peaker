"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { isUuid } from "@/lib/validation/uuid";

type PayoutSourceType = "group_lesson" | "private_lesson";

type AddCoachPayoutItemInput = {
  sourceType: PayoutSourceType;
  sourceId: string;
  coachId: string;
  organizationId?: string | null;
};

function normalizeLessonStatus(status: string | null | undefined): "planned" | "completed" | "cancelled" {
  const s = String(status || "").toLowerCase();
  if (s === "cancelled") return "cancelled";
  if (s === "completed") return "completed";
  return "planned";
}

export async function addCoachPayoutItem(input: AddCoachPayoutItemInput) {
  const resolved = await resolveSessionActor();
  if ("error" in resolved) return { error: resolved.error };
  const role = getSafeRole(resolved.actor.role);
  if (role !== "admin" && role !== "super_admin") {
    return { error: "Bu işlem sadece yönetici tarafından yapılabilir." };
  }
  const organizationId = role === "super_admin" ? (input.organizationId || "").trim() : resolved.actor.organizationId;
  if (role === "super_admin" && !isUuid(organizationId)) {
    return { error: "Super admin için organizationId zorunludur." };
  }
  if (!organizationId) return { error: "Organizasyon bilgisi alınamadı." };

  const sourceType = input.sourceType;
  const sourceId = (input.sourceId || "").trim();
  const coachId = (input.coachId || "").trim();
  if ((sourceType !== "group_lesson" && sourceType !== "private_lesson") || !isUuid(sourceId) || !isUuid(coachId)) {
    return { error: "Geçersiz ödeme kalemi bilgisi." };
  }

  const adminClient = createSupabaseAdminClient();
  let lessonCoachId: string | null = null;
  let normalizedStatus: "planned" | "completed" | "cancelled" = "planned";
  let lessonDate = "";

  if (sourceType === "group_lesson") {
    const { data: lesson, error } = await adminClient
      .from("training_schedule")
      .select("coach_id, status, start_time")
      .eq("organization_id", organizationId)
      .eq("id", sourceId)
      .maybeSingle();
    if (error || !lesson) return { error: "Grup dersi bulunamadı." };
    lessonCoachId = lesson.coach_id || null;
    normalizedStatus = normalizeLessonStatus(lesson.status);
    lessonDate = String(lesson.start_time || "").slice(0, 10);
  } else {
    const { data: lesson, error } = await adminClient
      .from("private_lesson_sessions")
      .select("coach_id, status, starts_at")
      .eq("organization_id", organizationId)
      .eq("id", sourceId)
      .maybeSingle();
    if (error || !lesson) return { error: "Özel ders bulunamadı." };
    lessonCoachId = lesson.coach_id || null;
    normalizedStatus = normalizeLessonStatus(lesson.status);
    lessonDate = String(lesson.starts_at || "").slice(0, 10);
  }

  if (!lessonCoachId || lessonCoachId !== coachId) {
    return { error: "Koç eşleşmesi doğrulanamadı." };
  }
  if (normalizedStatus !== "completed") {
    return { error: "Sadece tamamlanan dersler koç ödeme listesine eklenebilir." };
  }

  const { data: existing } = await adminClient
    .from("coach_payout_items")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .maybeSingle();
  if (existing?.id) {
    return { success: true as const, payoutId: existing.id, status: existing.status as "eligible" | "included" | "paid" };
  }

  const { data: inserted, error: insertError } = await adminClient
    .from("coach_payout_items")
    .insert({
      organization_id: organizationId,
      coach_id: coachId,
      source_type: sourceType,
      source_id: sourceId,
      lesson_date: lessonDate,
      status: "included",
    })
    .select("id, status")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: conflictRow } = await adminClient
        .from("coach_payout_items")
        .select("id, status")
        .eq("organization_id", organizationId)
        .eq("source_type", sourceType)
        .eq("source_id", sourceId)
        .maybeSingle();
      if (conflictRow?.id) {
        return { success: true as const, payoutId: conflictRow.id, status: conflictRow.status as "eligible" | "included" | "paid" };
      }
    }
    return { error: `Koç ödeme kalemi eklenemedi: ${insertError.message}` };
  }

  revalidatePath("/muhasebe-finans");
  return { success: true as const, payoutId: inserted.id, status: inserted.status as "eligible" | "included" | "paid" };
}

export async function markCoachPayoutAsPaid(payoutId: string, organizationIdInput?: string | null) {
  const resolved = await resolveSessionActor();
  if ("error" in resolved) return { error: resolved.error };
  const role = getSafeRole(resolved.actor.role);
  if (role !== "admin" && role !== "super_admin") {
    return { error: "Bu işlem sadece yönetici tarafından yapılabilir." };
  }
  const organizationId = role === "super_admin" ? (organizationIdInput || "").trim() : resolved.actor.organizationId;
  if (role === "super_admin" && !isUuid(organizationId)) {
    return { error: "Super admin için organizationId zorunludur." };
  }
  if (!organizationId) return { error: "Organizasyon bilgisi alınamadı." };

  const safePayoutId = (payoutId || "").trim();
  if (!isUuid(safePayoutId)) return { error: "Geçersiz payout kimliği." };

  const adminClient = createSupabaseAdminClient();
  const { data: row, error: rowError } = await adminClient
    .from("coach_payout_items")
    .select("id, organization_id")
    .eq("id", safePayoutId)
    .maybeSingle();
  if (rowError || !row) return { error: "Koç ödeme kalemi bulunamadı." };
  if (row.organization_id !== organizationId) {
    return { error: "Bu ödeme kalemine erişim yetkiniz yok." };
  }

  const { error: updateError } = await adminClient
    .from("coach_payout_items")
    .update({ status: "paid" })
    .eq("id", safePayoutId);
  if (updateError) return { error: `Durum güncellenemedi: ${updateError.message}` };

  revalidatePath("/muhasebe-finans");
  return { success: true as const };
}
