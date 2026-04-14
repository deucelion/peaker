"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { FINANCE_ADMIN_ONLY_MESSAGE } from "@/lib/finance/messages";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { insertNotificationsForUsers } from "@/lib/notifications/serverInsert";
import type { PaymentRow, PlayerWithPayments } from "@/types/domain";
import { toDisplayName } from "@/lib/profile/displayName";
import { resolveSessionActor, toTenantProfileRow } from "@/lib/auth/resolveSessionActor";
import { isUuid } from "@/lib/validation/uuid";
import { withServerActionGuard } from "@/lib/observability/serverActionError";

function assertUuid(id: string | null | undefined): id is string {
  return isUuid(id);
}

const MONTH_NAMES_TR = [
  "Ocak",
  "Subat",
  "Mart",
  "Nisan",
  "Mayis",
  "Haziran",
  "Temmuz",
  "Agustos",
  "Eylul",
  "Ekim",
  "Kasim",
  "Aralik",
] as const;

function resolvePaymentPeriod(dueDate: string | null): { monthName: string; yearInt: number } {
  const baseDate = dueDate ? new Date(`${dueDate}T00:00:00`) : new Date();
  if (Number.isNaN(baseDate.getTime())) {
    const now = new Date();
    return {
      monthName: MONTH_NAMES_TR[now.getMonth()] ?? "Ocak",
      yearInt: now.getFullYear(),
    };
  }
  return {
    monthName: MONTH_NAMES_TR[baseDate.getMonth()] ?? "Ocak",
    yearInt: baseDate.getFullYear(),
  };
}

async function resolveFinansAdmin(): Promise<
  { actorUserId: string; actorRole: string; organizationId: string } | { error: string }
> {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: true });
  if ("error" in resolved) return { error: resolved.error };
  const actor = toTenantProfileRow(resolved.actor);
  if (!actor.organization_id) return { error: "Kullanici profili dogrulanamadi." };
  if (getSafeRole(actor.role) !== "admin") {
    return { error: FINANCE_ADMIN_ONLY_MESSAGE };
  }

  return { actorUserId: actor.id, actorRole: actor.role, organizationId: actor.organization_id };
}

function mapPaymentRow(raw: {
  id: string;
  profile_id: string | null;
  organization_id: string;
  amount: number | string | null;
  payment_type: string;
  due_date: string | null;
  payment_date?: string | null;
  status: string;
  total_sessions: number | null;
  remaining_sessions: number | null;
  description: string | null;
}): PaymentRow {
  const pt = raw.payment_type === "paket" ? "paket" : "aylik";
  const st = raw.status === "odendi" ? "odendi" : "bekliyor";
  const ownerId = raw.profile_id || "";
  return {
    id: raw.id,
    profile_id: ownerId,
    organization_id: raw.organization_id,
    amount: Number(raw.amount) || 0,
    payment_type: pt,
    due_date: raw.due_date,
    payment_date: raw.payment_date ?? null,
    status: st,
    total_sessions: raw.total_sessions != null ? Number(raw.total_sessions) : null,
    remaining_sessions: raw.remaining_sessions != null ? Number(raw.remaining_sessions) : null,
    description: raw.description,
  };
}

export type OrgFinanceSnapshot = {
  players: PlayerWithPayments[];
  /** Tum bekleyen (status=bekliyor) odeme tutarlari toplami */
  pendingAmountTotal: number;
  /** odendi kayit sayisi / tum odeme kayitlari */
  collectionPowerPercent: number;
};

/**
 * Finans listesi: yalnizca oturumdaki org admin'i; org_id sunucuda profilden.
 * Tekil odeme kayitlari uzerinden tahsilat gucu ve bekleyen tutar.
 */
export async function listOrgPaymentsForAdmin(): Promise<
  { snapshot: OrgFinanceSnapshot } | { error: string }
> {
  return withServerActionGuard("finance.listOrgPaymentsForAdmin", async () => {
  const resolved = await resolveFinansAdmin();
  if ("error" in resolved) return { error: resolved.error };

  const adminClient = createSupabaseAdminClient();
  const { data: profileRows, error: profileError } = await adminClient
    .from("profiles")
    .select("id, full_name, email, number, position, team, organization_id, role, avatar_url")
    .eq("organization_id", resolved.organizationId)
    .eq("role", "sporcu")
    .order("full_name");

  if (profileError) return { error: `Finans verisi alinamadi: ${profileError.message}` };

  const athleteIds = (profileRows || []).map((p) => p.id);

  let paymentRows: Array<Parameters<typeof mapPaymentRow>[0]> = [];
  if (athleteIds.length > 0) {
    const { data: payData, error: payError } = await adminClient
      .from("payments")
      .select(
        "id, profile_id, organization_id, amount, payment_type, due_date, payment_date, status, total_sessions, remaining_sessions, description"
      )
      .eq("organization_id", resolved.organizationId)
      .in("profile_id", athleteIds);
    if (payError) return { error: `Odeme listesi alinamadi: ${payError.message}` };
    paymentRows = (payData || []) as Array<Parameters<typeof mapPaymentRow>[0]>;
  }

  const paymentsByProfile = new Map<string, PaymentRow[]>();
  paymentRows.forEach((row) => {
    const mapped = mapPaymentRow(row);
    const list = paymentsByProfile.get(mapped.profile_id) || [];
    list.push(mapped);
    paymentsByProfile.set(mapped.profile_id, list);
  });

  const players = (profileRows || []).map((row) => ({
    id: row.id,
    full_name: toDisplayName(row.full_name, row.email, "Sporcu"),
    number: row.number ?? null,
    position: row.position ?? null,
    team: row.team ?? null,
    organization_id: row.organization_id ?? null,
    role: row.role ?? undefined,
    avatar_url: row.avatar_url ?? null,
    payments: paymentsByProfile.get(row.id) || [],
  })) as PlayerWithPayments[];

  const allPayments = players.flatMap((p) => p.payments || []);
  const pendingAmountTotal = allPayments
    .filter((pay) => pay.status === "bekliyor")
    .reduce((sum, pay) => sum + (Number(pay.amount) || 0), 0);
  const collectionPowerPercent =
    allPayments.length === 0
      ? 0
      : Math.round((allPayments.filter((p) => p.status === "odendi").length / allPayments.length) * 100);

  return {
    snapshot: {
      players,
      pendingAmountTotal,
      collectionPowerPercent,
    },
  };
  });
}

export async function createOrgPayment(formData: FormData) {
  return withServerActionGuard("finance.createOrgPayment", async () => {
  const resolved = await resolveFinansAdmin();
  if ("error" in resolved) return { error: resolved.error };

  const profileId = formData.get("profile_id")?.toString().trim();
  if (!assertUuid(profileId)) return { error: "Gecersiz sporcu." };

  const amountRaw = formData.get("amount");
  const amount = typeof amountRaw === "string" ? Number(amountRaw) : Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
    return { error: "Gecersiz tutar." };
  }

  const paymentType = formData.get("payment_type")?.toString();
  if (paymentType !== "aylik" && paymentType !== "paket") {
    return { error: "Gecersiz odeme turu." };
  }

  const dueRaw = formData.get("due_date")?.toString().trim();
  const dueDate = dueRaw && dueRaw.length >= 8 ? dueRaw : null;
  const { monthName, yearInt } = resolvePaymentPeriod(dueDate);

  const desc = formData.get("desc")?.toString().trim().slice(0, 2000) || null;

  let totalSessions: number | null = null;
  let remainingSessions: number | null = null;
  if (paymentType === "paket") {
    const sessionsRaw = formData.get("sessions");
    const sessions = typeof sessionsRaw === "string" ? Number(sessionsRaw) : Number(sessionsRaw);
    if (!Number.isInteger(sessions) || sessions < 1 || sessions > 10_000) {
      return { error: "Paket icin gecerli bir seans sayisi girin." };
    }
    totalSessions = sessions;
    remainingSessions = sessions;
  }

  const adminClient = createSupabaseAdminClient();

  const { data: athlete } = await adminClient
    .from("profiles")
    .select("id, role")
    .eq("id", profileId)
    .eq("organization_id", resolved.organizationId)
    .maybeSingle();

  if (!athlete || getSafeRole(athlete.role) !== "sporcu") {
    return { error: "Sporcu bu organizasyonda bulunamadi." };
  }

  const { data: paymentRow, error } = await adminClient
    .from("payments")
    .insert({
      profile_id: profileId,
      organization_id: resolved.organizationId,
      amount,
      payment_type: paymentType,
      due_date: dueDate,
      month_name: monthName,
      year_int: yearInt,
      status: "bekliyor",
      total_sessions: totalSessions,
      remaining_sessions: remainingSessions,
      description: desc,
    })
    .select("id")
    .single();

  if (error || !paymentRow) return { error: `Odeme kaydedilemedi: ${error?.message || "unknown"}` };

  await logAuditEvent({
    actorUserId: resolved.actorUserId,
    actorRole: resolved.actorRole,
    organizationId: resolved.organizationId,
    action: "payment.create",
    entityType: "payment",
    entityId: paymentRow.id as string,
  });

  try {
    const typeLabel = paymentType === "paket" ? `paket (${totalSessions} seans)` : "aylik aidat";
    await insertNotificationsForUsers(
      [profileId],
      `Yeni odeme kaydi: ₺${amount} (${typeLabel}). Durum: bekliyor.`
    );
  } catch {
    /* bildirim opsiyonel */
  }

  revalidatePath("/finans");
  return { success: true as const };
  });
}

export async function updateOrgPaymentStatus(paymentId: string, status: string) {
  return withServerActionGuard("finance.updateOrgPaymentStatus", async () => {
  const resolved = await resolveFinansAdmin();
  if ("error" in resolved) return { error: resolved.error };

  if (status !== "bekliyor" && status !== "odendi") {
    return { error: "Gecersiz odeme durumu." };
  }
  if (!assertUuid(paymentId)) return { error: "Gecersiz odeme kaydi." };

  const adminClient = createSupabaseAdminClient();

  const { data: row } = await adminClient
    .from("payments")
    .select("id, profile_id, amount, payment_type")
    .eq("id", paymentId)
    .eq("organization_id", resolved.organizationId)
    .maybeSingle();

  if (!row) return { error: "Odeme kaydi bulunamadi." };

  const { error } = await adminClient
    .from("payments")
    .update({
      status,
      payment_date: status === "odendi" ? new Date().toISOString() : null,
    })
    .eq("id", paymentId)
    .eq("organization_id", resolved.organizationId);

  if (error) return { error: `Guncelleme basarisiz: ${error.message}` };

  await logAuditEvent({
    actorUserId: resolved.actorUserId,
    actorRole: resolved.actorRole,
    organizationId: resolved.organizationId,
    action: "payment.status.update",
    entityType: "payment",
    entityId: paymentId,
    metadata: { status },
  });

  try {
    const st = status === "odendi" ? "odendi" : "bekliyor";
    const notifiedProfileId = row.profile_id || "";
    await insertNotificationsForUsers(
      [notifiedProfileId],
      `Aidat durumu guncellendi: ₺${row.amount} (${row.payment_type}). Yeni durum: ${st}.`
    );
  } catch {
    /* bildirim opsiyonel */
  }

  revalidatePath("/finans");
  return { success: true as const };
  });
}

export async function decrementOrgPaymentPackageSession(paymentId: string) {
  return withServerActionGuard("finance.decrementOrgPaymentPackageSession", async () => {
  const resolved = await resolveFinansAdmin();
  if ("error" in resolved) return { error: resolved.error };

  if (!assertUuid(paymentId)) return { error: "Gecersiz odeme kaydi." };

  const adminClient = createSupabaseAdminClient();
  const { data: payment } = await adminClient
    .from("payments")
    .select("id, remaining_sessions, payment_type")
    .eq("id", paymentId)
    .eq("organization_id", resolved.organizationId)
    .maybeSingle();

  if (!payment) return { error: "Odeme kaydi bulunamadi." };
  if (payment.payment_type !== "paket") return { error: "Bu islem yalnizca paket odemeleri icindir." };

  const current = Number(payment.remaining_sessions) || 0;
  if (current <= 0) return { error: "Paket seansi kalmadi." };

  const { error } = await adminClient
    .from("payments")
    .update({ remaining_sessions: current - 1 })
    .eq("id", paymentId)
    .eq("organization_id", resolved.organizationId);

  if (error) return { error: `Guncelleme basarisiz: ${error.message}` };

  await logAuditEvent({
    actorUserId: resolved.actorUserId,
    actorRole: resolved.actorRole,
    organizationId: resolved.organizationId,
    action: "payment.status.update",
    entityType: "payment",
    entityId: paymentId,
    metadata: { op: "package_session_decrement" },
  });

  revalidatePath("/finans");
  return { success: true as const };
  });
}
