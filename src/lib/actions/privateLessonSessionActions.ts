"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { getCoachPermissions, hasCoachPermission } from "@/lib/auth/coachPermissions";
import { messageIfAthleteCannotOperate } from "@/lib/athlete/lifecycle";
import { messageIfCoachCannotOperate } from "@/lib/coach/lifecycle";
import { assertCriticalSchemaReady } from "@/lib/diagnostics/systemHealth";
import {
  packageAllowsNewSessions,
  packageAllowsUsage,
  resolvePackageLifecycleStatus,
} from "@/lib/privateLessons/packageStatus";
import { appendPrivateLessonPackageEvent } from "@/lib/privateLessons/appendPrivateLessonPackageEvent";
import {
  coachMayManagePrivateLessonSession,
  mapRpcCompleteErrorToUserMessage,
} from "@/lib/privateLessons/completeSessionPolicy";
import {
  buildPrivateLessonParallelPlanningMetrics,
  resolveCoachSlotCapacityLevel,
  type PrivateLessonSlotOverlapPreviewResult,
} from "@/lib/privateLessons/privateLessonSlotOverlap";
import { resolveOrganizationTimeZone } from "@/lib/organization/timeZone";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { appendOperationalTimeline } from "@/lib/operational/timeline";
import {
  getSchemaCapabilities,
  packageCompletedUpdatePayload,
  runPackageLifecycleProbeWithCompat,
  userFacingDataError,
} from "@/lib/schemaCompat";
import { diagnosticsCode, operationalError } from "@/lib/ui/operationalErrors";
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
  }

  const { data, error } = await adminClient
    .from("private_lesson_sessions")
    .select(SESSION_SELECT)
    .eq("package_id", pid)
    .eq("organization_id", actor.organization_id)
    .order("starts_at", { ascending: false })
    .limit(120);

  if (error) {
    return {
      error: operationalError("Planlar alınamadı", {
        rawMessage: error.message,
        code: diagnosticsCode("PLN", "list"),
      }),
    };
  }
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

  if (error) {
    return {
      error: operationalError("Planlar alınamadı", {
        rawMessage: error.message,
        code: diagnosticsCode("PLN", "list"),
      }),
    };
  }
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

  if (error) {
    return {
      error: operationalError("Planlar alınamadı", {
        rawMessage: error.message,
        code: diagnosticsCode("PLN", "list"),
      }),
    };
  }
  return { sessions: (data || []).map((row) => mapSessionRow(row as never)) };
}

async function resolvePrivateLessonSlotFromForm(
  formData: FormData,
  actor: Actor,
  adminClient: ReturnType<typeof createSupabaseAdminClient>
): Promise<{ coachId: string; start: Date; end: Date } | { error: string }> {
  const lessonDate = formData.get("lessonDate")?.toString().trim() || "";
  const startClock = formData.get("startClock")?.toString().trim() || "";
  const durationMinutes = Math.floor(Number(formData.get("durationMinutes")?.toString() || "60"));
  const coachIdInput = formData.get("coachId")?.toString().trim() || "";

  if (!lessonDate || !startClock) return { error: "Tarih ve başlangıç saati zorunludur." };
  if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) {
    return { error: "Süre 15–480 dakika arasında olmalıdır." };
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
  if (!coachId) return { error: "Koç bilgisi çözümlenemedi." };

  const startUtcIso = wallClockInZoneToUtcIso(lessonDate, startClock);
  if (!startUtcIso) return { error: "Geçersiz tarih veya saat." };
  const start = new Date(startUtcIso);
  if (Number.isNaN(start.getTime())) return { error: "Geçersiz tarih veya saat." };
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { coachId, start, end };
}

const OVERLAP_PEER_SELECT =
  "id, starts_at, ends_at, athlete_profile:profiles!private_lesson_sessions_athlete_id_fkey(full_name, email), pkg:private_lesson_packages!private_lesson_sessions_package_id_fkey(package_name)";

/** Aynı koç / çakışan zaman dilimindeki planlı özel dersler (bilgilendirme; engellemez). */
export async function previewPrivateLessonCoachSlotOverlaps(formData: FormData) {
  return withServerActionGuard("privateLesson.previewPrivateLessonCoachSlotOverlaps", async () => {
    const schemaError = await assertCriticalSchemaReady(["private_lesson_sessions_ready"]);
    if (schemaError) return { error: schemaError };

    const resolved = await resolveActor();
    if ("error" in resolved) return { error: resolved.error };
    const { actor } = resolved;
    const mg = await assertManagement(actor);
    if (!mg.ok) return { error: mg.error };

    const adminClient = createSupabaseAdminClient();
    const slot = await resolvePrivateLessonSlotFromForm(formData, actor, adminClient);
    if ("error" in slot) return { error: slot.error };

    const packageId = formData.get("packageId")?.toString().trim() || "";
    let newAthleteName = "Sporcu";
    if (packageId) {
      const { data: pkgRow } = await adminClient
        .from("private_lesson_packages")
        .select("athlete_id, athlete_profile:profiles!private_lesson_packages_athlete_id_fkey(full_name, email)")
        .eq("id", packageId)
        .eq("organization_id", actor.organization_id!)
        .maybeSingle();
      if (pkgRow) {
        const athlete = Array.isArray(pkgRow.athlete_profile) ? pkgRow.athlete_profile[0] : pkgRow.athlete_profile;
        newAthleteName = athlete ? toDisplayName(athlete.full_name, athlete.email, "Sporcu") : newAthleteName;
      }
    }

    const { data, error } = await adminClient
      .from("private_lesson_sessions")
      .select(OVERLAP_PEER_SELECT)
      .eq("organization_id", actor.organization_id!)
      .eq("status", "planned")
      .eq("coach_id", slot.coachId)
      .lt("starts_at", slot.end.toISOString())
      .gt("ends_at", slot.start.toISOString())
      .order("starts_at", { ascending: true })
      .limit(24);
    if (error) {
      return {
        error: operationalError("Plan kontrolü başarısız", {
          rawMessage: error.message,
          code: diagnosticsCode("PLN", "overlap_preview"),
        }),
      };
    }

    const peers = (data || []).map((row) => {
      const athlete = Array.isArray(row.athlete_profile) ? row.athlete_profile[0] : row.athlete_profile;
      const pkg = Array.isArray(row.pkg) ? row.pkg[0] : row.pkg;
      return {
        id: row.id as string,
        athleteName: athlete ? toDisplayName(athlete.full_name, athlete.email, "Sporcu") : null,
        packageName: (pkg?.package_name as string | null) ?? null,
        startsAt: row.starts_at as string,
        endsAt: row.ends_at as string,
      };
    });

    const overlappingCount = peers.length;
    const totalAfterCreate = overlappingCount + 1;
    const preview: PrivateLessonSlotOverlapPreviewResult = {
      overlappingCount,
      peers,
      slotStartsAt: slot.start.toISOString(),
      slotEndsAt: slot.end.toISOString(),
      newAthleteName,
      totalAfterCreate,
      capacityLevel: resolveCoachSlotCapacityLevel(totalAfterCreate),
    };

    return preview;
  });
}

export async function getPrivateLessonParallelPlanningMetrics(referenceDateIso?: string) {
  return withServerActionGuard("privateLesson.getPrivateLessonParallelPlanningMetrics", async () => {
    const schemaError = await assertCriticalSchemaReady(["private_lesson_sessions_ready"]);
    if (schemaError) return { error: schemaError };

    const resolved = await resolveActor();
    if ("error" in resolved) return { error: resolved.error };
    const { actor } = resolved;
    const mg = await assertManagement(actor);
    if (!mg.ok) return { error: mg.error };

    const ref = referenceDateIso ? new Date(referenceDateIso) : new Date();
    const y = ref.getFullYear();
    const m = ref.getMonth();
    const monthStart = new Date(Date.UTC(y, m, 1)).toISOString();
    const monthEnd = new Date(Date.UTC(y, m + 1, 1)).toISOString();
    const monthLabel = ref.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

    const adminClient = createSupabaseAdminClient();
    const tz = await resolveOrganizationTimeZone(actor.organization_id!);
    const { data, error } = await adminClient
      .from("private_lesson_sessions")
      .select("id, coach_id, starts_at, ends_at, status")
      .eq("organization_id", actor.organization_id!)
      .gte("starts_at", monthStart)
      .lt("starts_at", monthEnd)
      .limit(5000);
    if (error) {
      return {
        error: operationalError("Özel ders metrikleri alınamadı", {
          rawMessage: error.message,
          code: diagnosticsCode("PLN", "parallel_metrics"),
        }),
      };
    }

    const sessions = (data || []).map((row) => ({
      id: row.id as string,
      coachId: row.coach_id as string,
      startsAt: row.starts_at as string,
      endsAt: row.ends_at as string,
      status: (row.status as string) || "planned",
    }));

    return { metrics: buildPrivateLessonParallelPlanningMetrics(sessions, monthLabel, tz) };
  });
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
    const location = formData.get("location")?.toString().trim() || null;
    const note = formData.get("note")?.toString().trim() || null;

    if (!packageId || !lessonDate || !startClock) return { error: "Paket, tarih ve başlangıç saati zorunludur." };
    if (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) {
      return { error: "Süre 15–480 dakika arasında olmalıdır." };
    }

    const adminClient = createSupabaseAdminClient();
    const caps = await getSchemaCapabilities();
    const pkgFetch = await runPackageLifecycleProbeWithCompat(caps, async (select) => {
      const { data, error } = await adminClient
        .from("private_lesson_packages")
        .select(select)
        .eq("id", packageId)
        .eq("organization_id", actor.organization_id!)
        .maybeSingle();
      return { data, error };
    });
    if (pkgFetch.error || !pkgFetch.data) {
      return { error: userFacingDataError("Paket bulunamadı", pkgFetch.error?.message) };
    }
    const pkg = pkgFetch.data as unknown as {
      id: string;
      organization_id: string;
      athlete_id: string;
      coach_id: string | null;
      package_name: string;
      is_active: boolean;
      lifecycle_status?: string | null;
      remaining_lessons: number;
      total_lessons: number;
      used_lessons: number;
    };
    const lifecycle = resolvePackageLifecycleStatus({
      lifecycleStatus: pkg.lifecycle_status,
      isActive: Boolean(pkg.is_active),
      remainingLessons: pkg.remaining_lessons ?? 0,
      totalLessons: pkg.total_lessons ?? 0,
      usedLessons: pkg.used_lessons ?? 0,
    });
    if (!packageAllowsNewSessions(lifecycle)) {
      return { error: "Bu paket durumunda yeni ders planlanamaz." };
    }
    if (pkg.remaining_lessons <= 0) return { error: "Aktif pakette kalan ders hakkı yok; plan oluşturulamaz." };

    const { count: plannedCount, error: countErr } = await adminClient
      .from("private_lesson_sessions")
      .select("id", { count: "exact", head: true })
      .eq("package_id", packageId)
      .eq("status", "planned");
    if (countErr) {
      return {
        error: operationalError("Plan kontrolü başarısız", {
          rawMessage: countErr.message,
          code: diagnosticsCode("PLN", "count"),
        }),
      };
    }
    const planned = plannedCount ?? 0;
    if (planned >= pkg.remaining_lessons) {
      return { error: "Açık plan sayısı kalan ders hakkı kadar; önce bir planı tamamlayın veya iptal edin." };
    }

    const slot = await resolvePrivateLessonSlotFromForm(formData, actor, adminClient);
    if ("error" in slot) return { error: slot.error };
    const { coachId, start, end } = slot;

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
        return {
          error:
            "Veritabanı hâlâ eski çakışma kuralını uyguluyor. Yöneticinize 20260721_private_lesson_parallel_coach_slots migration uygulamasını iletin.",
        };
      }
      return {
        error: operationalError("Plan oluşturulamadı", {
          rawMessage: insertErr.message,
          code: diagnosticsCode("PLN", "create"),
        }),
      };
    }

    const { count: slotPeerCount } = await adminClient
      .from("private_lesson_sessions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", actor.organization_id!)
      .eq("status", "planned")
      .eq("coach_id", coachId)
      .lt("starts_at", end.toISOString())
      .gt("ends_at", start.toISOString());
    const activeInSlot = slotPeerCount ?? 0;
    if (activeInSlot >= 2) {
      await appendOperationalTimeline(adminClient, {
        organizationId: actor.organization_id,
        eventType: "private_lesson.parallel_slot",
        severity: activeInSlot >= 4 ? "warning" : "info",
        summary: `Paralel özel ders slotu · ${activeInSlot} planlı oturum`,
        payload: {
          coachId,
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          plannedSessionCount: activeInSlot,
        },
        actorUserId: actor.id,
      });
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
        `Yeni özel ders planlandı: ${when}${locPart} (${label}).`,
        "private_lesson.created"
      );
      if (coachId && coachId !== pkg.athlete_id) {
        await insertNotificationsForUsers(
          [coachId],
          `Özel ders planı: ${when}${locPart} · ${label}.`,
          "private_lesson.created"
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

async function revalidatePrivateLessonCompletionPaths(packageId: string, athleteId?: string | null) {
  revalidatePath("/haftalik-ders-programi");
  revalidatePath("/antrenman-yonetimi");
  revalidatePath("/ozel-ders-paketleri");
  revalidatePath("/ozel-ders-paketlerim");
  revalidatePath(`/ozel-ders-paketleri/${packageId}`);
  revalidatePath("/muhasebe-finans");
  revalidatePath("/bildirimler");
  revalidatePath("/");
  if (athleteId) revalidatePath(`/sporcu/${athleteId}`);
}

export async function completePrivateLessonSession(sessionId: string) {
  return withServerActionGuard("privateLesson.completePrivateLessonSession", async () => {
    const schemaError = await assertCriticalSchemaReady([
      "private_lesson_sessions_ready",
      "private_lesson_packages_ready",
    ]);
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
      .select("id, organization_id, coach_id, athlete_id, status, package_id, usage_record_id")
      .eq("id", sid)
      .eq("organization_id", actor.organization_id!)
      .maybeSingle();
    if (sErr || !sess) return { error: "Oturum bulunamadı." };

    const role = getSafeRole(actor.role);
    if (role === "coach") {
      const permissions = await getCoachPermissions(actor.id, actor.organization_id!);
      if (!coachMayManagePrivateLessonSession(role, permissions, sess.coach_id as string | null, actor.id)) {
        return { error: "Bu oturumu tamamlama yetkiniz yok." };
      }
    }

    if (sess.status === "cancelled") {
      return { error: "İptal edilmiş oturum tamamlanamaz." };
    }

    if (sess.status === "completed" || sess.usage_record_id) {
      await revalidatePrivateLessonCompletionPaths(sess.package_id as string, sess.athlete_id as string | null);
      return {
        success: true as const,
        alreadyCompleted: true as const,
        message: "Bu ders zaten yapıldı olarak işaretlenmiş.",
      };
    }

    if (sess.status !== "planned") {
      return { error: "Yalnızca planlanmış oturum tamamlanabilir." };
    }

    const caps = await getSchemaCapabilities();
    const pkgFetch = await runPackageLifecycleProbeWithCompat(caps, async (select) => {
      const { data, error } = await adminClient
        .from("private_lesson_packages")
        .select(select)
        .eq("id", sess.package_id as string)
        .eq("organization_id", actor.organization_id!)
        .maybeSingle();
      return { data, error };
    });
    if (pkgFetch.error || !pkgFetch.data) {
      return { error: userFacingDataError("Paket bulunamadı", pkgFetch.error?.message) };
    }
    const pkg = pkgFetch.data as unknown as {
      athlete_id: string;
      coach_id: string | null;
      package_name?: string;
      used_lessons: number;
      total_lessons: number;
      remaining_lessons: number;
      is_active: boolean;
      lifecycle_status?: string | null;
    };
    if (pkg.athlete_id && sess.athlete_id && pkg.athlete_id !== sess.athlete_id) {
      return { error: "Oturum sporcu bilgisi paketle uyuşmuyor." };
    }

    const lifecycle = resolvePackageLifecycleStatus({
      lifecycleStatus: pkg.lifecycle_status,
      isActive: Boolean(pkg.is_active),
      remainingLessons: pkg.remaining_lessons ?? 0,
      totalLessons: pkg.total_lessons ?? 0,
      usedLessons: pkg.used_lessons ?? 0,
    });
    if (!packageAllowsUsage(lifecycle)) {
      return { error: "Bu paket durumunda ders kullanımı yapılamaz." };
    }
    if (pkg.remaining_lessons <= 0 || pkg.used_lessons >= pkg.total_lessons) {
      return { error: "Pakette kullanılacak ders kalmadı." };
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
      return {
        error: operationalError("Ders tamamlanamadı", {
          rawMessage: rpcErr.message,
          code: diagnosticsCode("PLN", "complete"),
        }),
      };
    }

    const payload = rpcData as { ok?: boolean; error?: string; usage_id?: string } | null;
    if (!payload?.ok) {
      captureServerActionSignal("privateLesson.completePrivateLessonSession", "complete_session_rpc_rejected", {
        sessionId: sid,
        actorId: actor.id,
        organizationId: actor.organization_id,
        rpcPayload: payload,
      });
      return { error: mapRpcCompleteErrorToUserMessage(payload?.error) };
    }

    const { data: pkgAfter } = await adminClient
      .from("private_lesson_packages")
      .select("remaining_lessons, used_lessons, total_lessons, is_active, lifecycle_status")
      .eq("id", sess.package_id as string)
      .maybeSingle();
    const nextRemaining = Number((pkgAfter as { remaining_lessons?: number } | null)?.remaining_lessons ?? 0);
    const completedPayload = packageCompletedUpdatePayload(caps, nextRemaining);
    if (Object.keys(completedPayload).length > 0) {
      await adminClient
        .from("private_lesson_packages")
        .update(completedPayload)
        .eq("id", sess.package_id as string)
        .eq("organization_id", actor.organization_id!);
    }

    await appendPrivateLessonPackageEvent(adminClient, {
      packageId: sess.package_id as string,
      organizationId: actor.organization_id!,
      actorId: actor.id,
      eventType: "lesson_used",
      title: "Ders hakkı kullanıldı",
      description: "Özel ders yapıldı olarak işaretlendi",
      metadata: { sessionId: sid, usageId: payload.usage_id ?? null, nextRemaining },
    });

    await logAuditEvent({
      organizationId: actor.organization_id,
      actorUserId: actor.id,
      actorRole: actor.role,
      action: "private_lesson_session.complete",
      entityType: "private_lesson_session",
      entityId: sid,
      metadata: { packageId: sess.package_id, usageId: payload.usage_id ?? null },
    });
    await logAuditEvent({
      organizationId: actor.organization_id,
      actorUserId: actor.id,
      actorRole: actor.role,
      action: "private_lesson_package.lesson_used",
      entityType: "private_lesson_package",
      entityId: sess.package_id as string,
      metadata: { sessionId: sid, nextRemaining },
    });

    await appendOperationalTimeline(adminClient, {
      organizationId: actor.organization_id,
      eventType: "private_lesson.completed",
      summary: `Özel ders tamamlandı · kalan ${nextRemaining}`,
      payload: { sessionId: sid, packageId: sess.package_id },
      actorUserId: actor.id,
    });

    const pName = pkg.package_name || "Özel ders paketi";
    const athleteId = (pkg.athlete_id || sess.athlete_id) as string | undefined;
    try {
      if (athleteId) {
        await insertNotificationsForUsers(
          [athleteId],
          "Özel dersiniz yapıldı olarak işaretlendi.",
          "private_lesson.updated"
        );
      }
      const coachNotifyId = (sess.coach_id as string | null) || pkg.coach_id;
      if (coachNotifyId && coachNotifyId !== athleteId) {
        await insertNotificationsForUsers(
          [coachNotifyId],
          "Özel ders tamamlandı olarak kaydedildi.",
          "private_lesson.updated"
        );
      }
      if (role === "admin") {
        const { data: admins } = await adminClient
          .from("profiles")
          .select("id")
          .eq("organization_id", actor.organization_id!)
          .eq("role", "admin")
          .neq("id", actor.id)
          .limit(8);
        const adminIds = (admins || []).map((r) => r.id as string).filter(Boolean);
        if (adminIds.length > 0) {
          await insertNotificationsForUsers(
            adminIds,
            `${pName}: Özel ders tamamlandı ve paket hakkı düşüldü.`,
            "private_lesson.updated"
          );
        }
      }
    } catch {
      /* bildirim opsiyonel */
    }

    await revalidatePrivateLessonCompletionPaths(sess.package_id as string, athleteId ?? null);
    return {
      success: true as const,
      message: "Ders tamamlandı ve paket hakkı düşüldü.",
      nextRemaining,
    };
  });
}

/** Haftalık çizelge modalından özel dersi tamamla (aynı atomik RPC + senkron). */
export async function markPrivateLessonSessionCompletedFromSchedule(sessionId: string) {
  return completePrivateLessonSession(sessionId);
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
    if (role === "coach") {
      const permissions = await getCoachPermissions(actor.id, actor.organization_id!);
      if (!coachMayManagePrivateLessonSession(role, permissions, sess.coach_id as string | null, actor.id)) {
        return { error: "Bu oturumu iptal etme yetkiniz yok." };
      }
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
    if (uErr) {
      return {
        error: operationalError("Plan iptal edilemedi", {
          rawMessage: uErr.message,
          code: diagnosticsCode("PLN", "cancel"),
        }),
      };
    }

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
          `Özel ders planı iptal edildi: ${when}.`,
          "private_lesson.cancelled"
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
