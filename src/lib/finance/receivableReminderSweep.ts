import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { logger } from "@/lib/monitoring/logger";
import { insertNotificationsForUsers } from "@/lib/notifications/serverInsert";
import { computeReceivableStatus } from "@/lib/finance/receivableStatus";
import { getSchemaCapabilities } from "@/lib/schemaCompat";
import { resolvePackageLifecycleStatus } from "@/lib/privateLessons/packageStatus";
import { normalizeMoney } from "@/lib/privateLessons/packageMath";

function istanbulDateKeyToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Worker/günlük tetik: gecikmiş / yaklaşan paket taksitleri için yönetici bildirimi.
 * Online ödeme yok; yalnızca takip uyarısı. Dedup: receivable_reminder_sent.
 */
export async function runReceivableReminderSweepIfDue(): Promise<{
  ran: boolean;
  orgs: number;
  sent: number;
}> {
  const today = istanbulDateKeyToday();
  const adminClient = createSupabaseAdminClient();

  const { data: stateRow } = await adminClient.from("peaker_receivable_sweep_state").select("last_run_on").eq("id", 1).maybeSingle();
  const last = (stateRow as { last_run_on?: string | null } | null)?.last_run_on;
  if (last === today) {
    return { ran: false, orgs: 0, sent: 0 };
  }

  const { data: orgs } = await adminClient.from("organizations").select("id").limit(500);
  const orgList = (orgs || []).map((o) => o.id as string);
  let sent = 0;

  const todayDate = new Date(`${today}T12:00:00+03:00`);

  for (const organizationId of orgList) {
    const { data: adminProfiles } = await adminClient
      .from("profiles")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("role", "admin");
    const adminIds = (adminProfiles || []).map((p) => p.id as string).filter(Boolean);
    if (adminIds.length === 0) continue;

    const caps = await getSchemaCapabilities();
    let selectCols = "id, organization_id, athlete_id, package_name, total_price, amount_paid, is_active";
    if (caps.packages.installmentFields) selectCols += ", next_payment_due_at";
    if (caps.packages.lifecycleStatus) selectCols += ", lifecycle_status";

    let pkgQuery = adminClient
      .from("private_lesson_packages")
      .select(selectCols)
      .eq("organization_id", organizationId);
    if (caps.packages.lifecycleStatus) {
      pkgQuery = pkgQuery.not("lifecycle_status", "eq", "refunded").not("lifecycle_status", "eq", "cancelled");
    }
    const { data: pkgs } = await pkgQuery;

    type SweepPkg = {
      id: string;
      athlete_id: string;
      package_name: string;
      total_price: number | string | null;
      amount_paid: number | string | null;
      next_payment_due_at?: string | null;
      is_active?: boolean;
      lifecycle_status?: string | null;
    };
    for (const pkg of (pkgs || []) as unknown as SweepPkg[]) {
      if (!caps.packages.lifecycleStatus) {
        const ls = resolvePackageLifecycleStatus({
          lifecycleStatus: null,
          isActive: Boolean((pkg as { is_active?: boolean }).is_active),
          remainingLessons: 1,
          totalLessons: 1,
          usedLessons: 0,
        });
        if (ls === "refunded" || ls === "cancelled") continue;
      }
      const total = normalizeMoney(Number(pkg.total_price) || 0);
      const paid = normalizeMoney(Number(pkg.amount_paid) || 0);
      const remaining = Math.max(0, total - paid);
      if (remaining <= 0.001) continue;

      const r = computeReceivableStatus({
        totalPrice: total,
        amountPaid: paid,
        nextPaymentDueAt: pkg.next_payment_due_at as string | null,
        today: todayDate,
      });
      if (r.status !== "overdue" && r.status !== "due_soon") continue;

      const kind = r.status === "overdue" ? "overdue" : "due_soon";
      const { error: insErr } = await adminClient.from("receivable_reminder_sent").insert({
        organization_id: organizationId,
        package_id: pkg.id,
        alert_kind: kind,
        sent_on: today,
      });
      if (insErr) {
        if (!insErr.message.includes("duplicate") && insErr.code !== "23505") {
          logger.warn("receivable.reminder", "dedup insert failed", { reason: insErr.message });
        }
        continue;
      }

      const label = kind === "overdue" ? "Gecikmiş tahsilat" : "Yaklaşan tahsilat";
      const msg = `${label}: ${pkg.package_name} — Manuel takip gerekebilir (online tahsilat yok). Kalan: ₺${remaining.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}.`;
      const notifType = kind === "overdue" ? ("receivable.overdue" as const) : ("receivable.due_soon" as const);
      await insertNotificationsForUsers(adminIds, msg, notifType);
      sent += 1;
    }
  }

  await adminClient.from("peaker_receivable_sweep_state").upsert({ id: 1, last_run_on: today }, { onConflict: "id" });

  logger.info("receivable.reminder", "sweep complete", { today, orgs: orgList.length, sent });
  return { ran: true, orgs: orgList.length, sent };
}
