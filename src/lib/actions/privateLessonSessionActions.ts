"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { getCoachPermissions, hasCoachPermission } from "@/lib/auth/coachPermissions";
import { messageIfAthleteCannotOperate } from "@/lib/athlete/lifecycle";
import { messageIfCoachCannotOperate } from "@/lib/coach/lifecycle";
import { assertCriticalSchemaReady } from "@/lib/diagnostics/systemHealth";
import { insertNotificationsForUsers } from "@/lib/notifications/serverInsert";
import { wallClockInZoneToUtcIso } from "@/lib/schedule/scheduleWallTime";
import type { PrivateLessonSessionListItem, PrivateLessonSessionStatus } from "@/lib/types";
import { toDisplayName } from "@/lib/profile/displayName";
import { resolveSessionActor, toTenantProfileRow } from "@/lib/auth/resolveSessionActor";
import { withServerActionGuard } from "@/lib/observability/serverActionError";
import { captureServerActionSignal } from "@/lib/observability/serverActionError";

type Actor = {
  id: string;
  role: string;
  organization_id: string | null;
  is_active: boolean | null;
};

async function resolveActor(): Promise<{ actor: Actor } | { error: string }> {
  const resolved = await resolveSessionActor();
  if ("error" in resolved) return resolved;
  const row = toTenantProfileRow(resolved.actor);
  const coachBlock = messageIfCoachCannotOperate(row.role, row.is_active);
  if (coachBlock) return { error: coachBlock };
  const athleteBlock = messageIfAthleteCannotOperate(row.role, row.is_active);
  if (athleteBlock) return { error: athleteBlock };
  return { actor: row as Actor };
}

async function assertManagement(actor: Actor): Promise<{ ok: true } | { ok: false; error: string }> {
  const role = getSafeRole(actor.role);
  if (role !== "admin" && role !== "coach") return { ok: false, error: "Bu işlem için yetkiniz yok." };
  if (!actor.organization_id) return { ok: false, error: "Organizasyon bilgisi eksik." };
  if (role === "coach") {
    const permissions = await getCoachPermissions(actor.id, actor.organization_id);
    if (!hasCoachPermission(permissions, "can_manage_training_notes")) {
      return { ok: false, error: "Özel ders paketi yönetimi yetkiniz yok." };
    }
  }
  return { ok: true };
}

function mapSessionRow(raw: {
  id: string;
  organization_id: string;
  package_id: string;
  athlete_id: string;
  coach_id: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  note: string | null;
  status: string;
  completed_at: string | null;
  cancelled_at: string | null;
  coach_profile?: { full_name?: string | null; email?: string | null } | { full_name?: string | null; email?: string | null }[] | null;
  athlete_profile?: { full_name?: string | null; email?: string | null } | { full_name?: string | null; email?: string | null }[] | null;
  pkg?: { package_name?: string | null } | { package_name?: string | null }[] | null;
}): PrivateLessonSessionListItem {
  const coach = Array.isArray(raw.coach_profile) ? raw.coach_profile[0] : raw.coach_profile;
  const athlete = Array.isArray(raw.athlete_profile) ? raw.athlete_profile[0] : raw.athlete_profile;
  const pkg = Array.isArray(raw.pkg) ? raw.pkg[0] : raw.pkg;
  return {
    id: raw.id,
    organizationId: raw.organization_id,
    packageId: raw.package_id,
    packageName: pkg?.package_name ?? null,
    athleteId: raw.athlete_id,
    athleteName: athlete ? toDisplayName(athlete.full_name, athlete.email, "Sporcu") : null,
    coachId: raw.coach_id,
    coachName: coach ? toDisplayName(coach.full_name, coach.email, "Koç") : null,
    startsAt: raw.starts_at,
    endsAt: raw.ends_at,
    location: raw.location,
    note: raw.note,
    status: raw.status as PrivateLessonSessionStatus,
    completedAt: raw.completed_at,
    cancelledAt: raw.cancelled_at,
  };
}

const SESSION_SELECT =
  "id, organization_id, package_id, athlete_id, coach_id, starts_at, ends_at, location, note, status, completed_at, cancelled_at, coach_profile:profiles!private_lesson_sessions_coach_id_fkey(full_name, email), athlete_profile:profiles!private_lesson_sessions_athlete_id_fkey(full_name, email), pkg:private_lesson_packages!private_lesson_sessions_package_id_fkey(package_name)";

export async function listPrivateLessonSessionsForPackage(
  packageId: string
): Promise<{ sessions: PrivateLessonSessionListItem[] } | { error: string }> {
  const schemaError = await assertCriticalSchemaReady(["private_lesson_sessions_ready", "private_lesson_packages_ready"]);
  if (schemaError) return { error: schemaError };

  const resolved = await resolveActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  const role = getSafeRole(actor.role);
  if (!actor.organization_id) return { error: "Organizasyon bilgisi eksik." };

  const pid = packageId?.trim() || "";
  if (!pid) return { error: "Paket seçimi zorunludur." };

  const adminClient = createSupabaseAdminClient();
  const { data: pkg } = await adminClient
    .from("private_lesson_packages")
    .select("id, athlete_id, organization_id")
    .eq("id", pid)
    .eq("organization_id", actor.organization_id)
    .maybeSingle();
  if (!pkg) return { error: "Paket bulunamadı." };

  if (role === "sporcu" && pkg.athlete_id !== actor.id) {
    return { error: "Bu paketin planlarını görüntüleyemezsiniz." };
  }
  if (role === "coach") {
    const mg = await assertManagement(actor);
    if (!mg.ok) return { error: mg.error };
    const permissions = await getCoachPermissions(actor.id, actor.organization_id);
    if (!permissions.can_view_all_organization_lessons) {
      const { data: ownSession } = await adminClient
        .from("private_lesson_sessions")
        .select("id")
        .eq("organization_id", actor.organization_id)
        .eq("package_id", pid)
        .eq("coach_id", actor.id)
        .limit(1)
        .maybeSingle();
      if (!ownSession) {
        return { error: "Bu paketin planlarını görüntüleme yetkiniz yok." };
      }
    }
  }

  const { data, error } = await adminClient
    .from("private_lesson_sessions")
    .select(SESSION_SELECT)
    .eq("package_id", pid)
    .eq("organization_id", actor.organization_id)
    .order("starts_at", { ascending: false })
    .limit(120);

  if (error) return { error: `Planlar alınamadı: ${error.message}` };
  return { sessions: (data || []).map((row) => mapSessionRow(row as never)) };
}

export async function listPrivateLessonSessionsForAthlete(): Promise<
  { sessions: PrivateLessonSessionListItem[] } | { error: string }
> {
  const schemaError = await assertCriticalSchemaReady(["private_lesson_sessions_ready"]);
  if (schemaError) return { error: schemaError };

  const resolved = await resolveActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  if (getSafeRole(actor.role) !== "sporcu") return { error: "Bu liste yalnızca sporcular içindir." };
  if (!actor.organization_id) return { error: "Organizasyon bilgisi eksik." };

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("private_lesson_sessions")
    .select(SESSION_SELECT)
    .eq("organization_id", actor.organization_id)
    .eq("athlete_id", actor.id)
    .order("starts_at", { ascending: false })
    .limit(80);

  if (error) return { error: `Planlar alınamadı: ${error.message}` };
  return { sessions: (data || []).map((row) => mapSessionRow(row as never)) };
}

export async function listUpcomingPrivateLessonSessionsForCoach(
  limit = 8
): Promise<{ sessions: PrivateLessonSessionListItem[] } | { error: string }> {
  const schemaError = await assertCriticalSchemaReady(["private_lesson_sessions_ready"]);
  if (schemaError) return { error: schemaError };

  const resolved = await resolveActor();
  if ("error" in resolved) return { error: resolved.error };
  const { actor } = resolved;
  const role = getSafeRole(actor.role);
  if (role !== "coach") return { error: "Bu liste yalnızca koçlar içindir." };
  if (!actor.organization_id) return { error: "Organizasyon bilgisi eksik." };
  const mg = await assertManagement(actor);
  if (!mg.ok) return { error: mg.error };

  const adminClient = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await adminClient
    .from("private_lesson_sessions")
    .select(SESSION_SELECT)
    .eq("organization_id", actor.organization_id)
    .eq("coach_id", actor.id)
    .eq("status", "planned")
    .gte("starts_at", nowIso)
    .order("starts_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 30));

  if (error) return { error: `Planlar alınamadı: ${error.message}` };
  return { sessions: (data || []).map((row) => mapSessionRow(row as never)) };
}

export async function createPrivateLessonSession(formData: FormData) {
  return withServerActionGuard("privateLesson.createPrivateLessonSession", async () => {
    const schemaError = await assertCriticalSchemaReady(["private_lesson_sessions_ready", "private_lesson_packages_ready"]);
    if (schemaError) return { error: schemaError };

    const resolved = await resolveActor();
    if ("error" in resolved) return { error: resolved.error };
    const { actor } = resolved;
    const mg = await assertManagement(actor);
    if (!mg.ok) return { error: mg.error };

    const packageId = formData.get("packageId")?.toString().trim() || "";
    const lessonDate = formData.get("lessonDate")?.toString().trim() || "";
    const startClock = formData.get("startClock")?.toString().trim() || "";
    const durationMinutes = Math.floor(Number(formData.get("durationMinutes")?.toString() || "60"));
    const coachIdInput = formData.get("coachId")?.toString().trim() || "";
    const location = formData.get("location")?.toString().trim() || null;
    const note = formData.get("note")?.toString().trim() || null;

    if (!packageId || !lessonDate || !startClock) return { error: "Paket, tarih ve başlangıç saati zorunludur." };
    if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) {
      return { error: "Süre 15–480 dakika arasında olmalıdır." };
    }

    const adminClient = createSupabaseAdminClient();
    const { data: pkg } = await adminClient
      .from("private_lesson_packages")
      .select("id, organization_id, athlete_id, coach_id, is_active, remaining_lessons, total_lessons, used_lessons, package_name")
      .eq("id", packageId)
      .eq("organization_id", actor.organization_id!)
      .maybeSingle();

    if (!pkg) return { error: "Paket bulunamadı." };
    if (!pkg.is_active) return { error: "Pasif paket için yeni ders planlanamaz." };
    if (pkg.remaining_lessons <= 0) return { error: "Aktif pakette kalan ders hakkı yok; plan oluşturulamaz." };

    const { count: plannedCount, error: countErr } = await adminClient
      .from("private_lesson_sessions")
      .select("id", { count: "exact", head: true })
      .eq("package_id", packageId)
      .eq("status", "planned");
    if (countErr) return { error: `Plan kontrolü başarısız: ${countErr.message}` };
    const planned = plannedCount ?? 0;
    if (planned >= pkg.remaining_lessons) {
      return { error: "Açık plan sayısı kalan ders hakkı kadar; önce bir planı tamamlayın veya iptal edin." };
    }

    const role = getSafeRole(actor.role);
    let coachId: string | null = null;
    if (role === "admin") {
      if (!coachIdInput) return { error: "Koç seçimi zorunludur." };
      const { data: coachProfile } = await adminClient
        .from("profiles")
        .select("id, role, organization_id")
        .eq("id", coachIdInput)
        .eq("organization_id", actor.organization_id!)
        .maybeSingle();
      if (!coachProfile || getSafeRole(coachProfile.role) !== "coach") return { error: "Seçilen koç bulunamadı." };
      coachId = coachProfile.id;
    } else {
      coachId = actor.id;
    }

    const startUtcIso = wallClockInZoneToUtcIso(lessonDate, startClock);
    if (!startUtcIso) return { error: "Geçersiz tarih veya saat." };
    const start = new Date(startUtcIso);
    if (Number.isNaN(start.getTime())) return { error: "Geçersiz tarih veya saat." };
    const end = new Date(start.getTime() + durationMinutes * 60_000);

    const { data: conflictRows, error: conflictErr } = await adminClient
      .from("private_lesson_sessions")
      .select("id")
      .eq("organization_id", actor.organization_id!)
      .eq("status", "planned")
      .eq("coach_id", coachId)
      .lt("starts_at", end.toISOString())
      .gt("ends_at", start.toISOString())
      .limit(1);
    if (conflictErr) return { error: `Plan kontrolü başarısız: ${conflictErr.message}` };
    if ((conflictRows || []).length > 0) {
      return { error: "Bu zaman aralığında seçili koçun başka bir özel dersi var." };
    }

    const { error: insertErr } = await adminClient.from("private_lesson_sessions").insert({
      organization_id: actor.organization_id,
      package_id: packageId,
      athlete_id: pkg.athlete_id,
      coach_id: coachId,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      location,
      note,
      status: "planned",
      created_by: actor.id,
    });
    if (insertErr) {
      if (insertErr.message.includes("private_lesson_sessions_no_overlap_planned")) {
        return { error: "Bu zaman aralığında seçili koçun başka bir özel dersi var." };
      }
      return { error: `Plan oluşturulamadı: ${insertErr.message}` };
    }

    const label = (pkg as { package_name?: string }).package_name || "Özel ders";
    const when = start.toLocaleString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const locPart = location ? ` · ${location}` : "";
    try {
      await insertNotificationsForUsers(
        [pkg.athlete_id as string],
        `Yeni özel ders planlandı: ${when}${locPart} (${label}).`
      );
      if (coachId && coachId !== pkg.athlete_id) {
        await insertNotificationsForUsers(
          [coachId],
          `Özel ders planı: ${when}${locPart} · ${label}.`
        );
      }
    } catch {
      /* bildirim opsiyonel */
    }

    revalidatePath("/ozel-ders-paketleri");
    revalidatePath("/ozel-ders-paketlerim");
    revalidatePath(`/ozel-ders-paketleri/${packageId}`);
    revalidatePath("/");
    return { success: true as const };
  });
}

export async function completePrivateLessonSession(sessionId: string) {
  return withServerActionGuard("privateLesson.completePrivateLessonSession", async () => {
    const schemaError = await assertCriticalSchemaReady(["private_lesson_sessions_ready", "private_lesson_packages_ready"]);
    if (schemaError) return { error: schemaError };

    const resolved = await resolveActor();
    if ("error" in resolved) return { error: resolved.error };
    const { actor } = resolved;
    const mg = await assertManagement(actor);
    if (!mg.ok) return { error: mg.error };

    const sid = sessionId?.trim() || "";
    if (!sid) return { error: "Oturum seçimi zorunludur." };

    const adminClient = createSupabaseAdminClient();
    const { data: sess, error: sErr } = await adminClient
      .from("private_lesson_sessions")
      .select("id, organization_id, coach_id, status, package_id")
      .eq("id", sid)
      .eq("organization_id", actor.organization_id!)
      .maybeSingle();
    if (sErr || !sess) return { error: "Oturum bulunamadı." };
    if (sess.status !== "planned") return { error: "Yalnızca planlanmış oturum tamamlanabilir." };

    const role = getSafeRole(actor.role);
    if (role === "coach" && sess.coach_id !== actor.id) {
      return { error: "Bu oturumu tamamlama yetkiniz yok." };
    }

    const { data: rpcData, error: rpcErr } = await adminClient.rpc("complete_private_lesson_session", {
      p_session_id: sid,
      p_completed_by: actor.id,
    });
    if (rpcErr) {
      captureServerActionSignal("privateLesson.completePrivateLessonSession", "complete_session_rpc_failed", {
        sessionId: sid,
        actorId: actor.id,
        organizationId: actor.organization_id,
        errorMessage: rpcErr.message,
      });
      return { error: `Tamamlama başarısız: ${rpcErr.message}` };
    }

    const payload = rpcData as { ok?: boolean; error?: string } | null;
    if (!payload?.ok) {
      captureServerActionSignal("privateLesson.completePrivateLessonSession", "complete_session_rpc_rejected", {
        sessionId: sid,
        actorId: actor.id,
        organizationId: actor.organization_id,
        rpcPayload: payload,
      });
      return { error: typeof payload?.error === "string" ? payload.error : "Tamamlama reddedildi." };
    }

    const { data: pkgRow } = await adminClient
      .from("private_lesson_packages")
      .select("athlete_id, package_name")
      .eq("id", sess.package_id as string)
      .maybeSingle();
    const pName = (pkgRow as { package_name?: string } | null)?.package_name || "Özel ders paketi";
    try {
      if (pkgRow?.athlete_id) {
        await insertNotificationsForUsers(
          [pkgRow.athlete_id as string],
          `${pName}: Planlanan özel ders tamamlandı; paketten 1 ders düşüldü.`
        );
      }
    } catch {
      /* opsiyonel */
    }

    revalidatePath("/ozel-ders-paketleri");
    revalidatePath("/ozel-ders-paketlerim");
    revalidatePath(`/ozel-ders-paketleri/${sess.package_id as string}`);
    revalidatePath("/");
    return { success: true as const };
  });
}

export async function cancelPrivateLessonSession(sessionId: string) {
  return withServerActionGuard("privateLesson.cancelPrivateLessonSession", async () => {
    const schemaError = await assertCriticalSchemaReady(["private_lesson_sessions_ready"]);
    if (schemaError) return { error: schemaError };

    const resolved = await resolveActor();
    if ("error" in resolved) return { error: resolved.error };
    const { actor } = resolved;
    const mg = await assertManagement(actor);
    if (!mg.ok) return { error: mg.error };

    const sid = sessionId?.trim() || "";
    if (!sid) return { error: "Oturum seçimi zorunludur." };

    const adminClient = createSupabaseAdminClient();
    const { data: sess, error: sErr } = await adminClient
      .from("private_lesson_sessions")
      .select("id, organization_id, coach_id, status, package_id, athlete_id, starts_at, location")
      .eq("id", sid)
      .eq("organization_id", actor.organization_id!)
      .maybeSingle();
    if (sErr || !sess) return { error: "Oturum bulunamadı." };
    if (sess.status !== "planned") return { error: "Yalnızca planlanmış oturum iptal edilebilir." };

    const role = getSafeRole(actor.role);
    if (role === "coach" && sess.coach_id !== actor.id) {
      return { error: "Bu oturumu iptal etme yetkiniz yok." };
    }

    const { error: uErr } = await adminClient
      .from("private_lesson_sessions")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: actor.id,
      })
      .eq("id", sid)
      .eq("status", "planned");
    if (uErr) return { error: `İptal başarısız: ${uErr.message}` };

    const when = new Date(sess.starts_at as string).toLocaleString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    try {
      if (sess.athlete_id) {
        await insertNotificationsForUsers(
          [sess.athlete_id as string],
          `Özel ders planı iptal edildi: ${when}.`
        );
      }
    } catch {
      /* opsiyonel */
    }

    revalidatePath("/ozel-ders-paketleri");
    revalidatePath("/ozel-ders-paketlerim");
    revalidatePath(`/ozel-ders-paketleri/${sess.package_id as string}`);
    revalidatePath("/");
    return { success: true as const };
  });
}
