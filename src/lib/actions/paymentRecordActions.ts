"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { isUuid } from "@/lib/validation/uuid";
import { logAuditEvent } from "@/lib/audit/logAuditEvent";
import { appendOperationalTimeline } from "@/lib/operational/timeline";
import { assertValidTRYMoneyAmount } from "@/lib/privateLessons/packageFinance";
import { parseTRYMoneyInput } from "@/lib/privateLessons/packageMath";
import {
  applyPrivateLessonPackagePaymentWithPaymentRow,
  paymentBookkeepingFromPaidAtIso,
} from "@/lib/privateLessons/packagePaymentSync";
import { resolveOrganizationTimeZone } from "@/lib/organization/timeZone";
import { withServerActionGuard } from "@/lib/observability/serverActionError";
import { getSchemaCapabilities, ledgerVoidUnavailableMessage } from "@/lib/schemaCompat";
import { diagnosticsCode, operationalError } from "@/lib/ui/operationalErrors";
import { isPaymentsSchemaCompatibilityError } from "@/lib/payments/paymentsSchemaCompatibility";

async function assertFinanceAdmin(formData?: FormData | null) {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: false });
  if ("error" in resolved) return { error: resolved.error } as const;
  const role = getSafeRole(resolved.actor.role);
  if (role !== "admin" && role !== "super_admin") return { error: "Bu işlem yalnızca yönetici içindir." } as const;
  if (role === "super_admin") {
    const orgFromForm = formData?.get("organizationId")?.toString().trim() || "";
    if (!isUuid(orgFromForm)) {
      return { error: "Super admin için organizasyon bağlamı eksik; muhasebe ekranından deneyin." } as const;
    }
    return { actor: resolved.actor, organizationId: orgFromForm } as const;
  }
  const organizationId = resolved.actor.organizationId || "";
  if (!organizationId) return { error: "Organizasyon bilgisi eksik." } as const;
  return { actor: resolved.actor, organizationId } as const;
}

/** Canonical `payments` satırını iptal (soft delete — silinmez). */
export async function cancelPaymentRecord(formData: FormData) {
  return withServerActionGuard("payment.cancelPaymentRecord", async () => {
    const gate = await assertFinanceAdmin(formData);
    if ("error" in gate) return { error: gate.error };
    const { actor, organizationId } = gate;

    const paymentId = formData.get("paymentId")?.toString().trim() || "";
    const reason = formData.get("reason")?.toString().trim() || "";
    if (!isUuid(paymentId)) return { error: "Geçersiz kayıt." };
    if (reason.length < 3) return { error: "İptal nedeni zorunludur." };

    const adminClient = createSupabaseAdminClient();
    const { data: row } = await adminClient
      .from("payments")
      .select("id, organization_id, deleted_at")
      .eq("id", paymentId)
      .maybeSingle();
    if (!row || row.organization_id !== organizationId) return { error: "Kayıt bulunamadı." };
    if (row.deleted_at) return { error: "Kayıt zaten iptal edilmiş." };

    const now = new Date().toISOString();
    const { error } = await adminClient
      .from("payments")
      .update({
        deleted_at: now,
        deleted_by: actor.id,
        delete_reason: `manual_cancel: ${reason.slice(0, 1500)}`,
      })
      .eq("id", paymentId)
      .eq("organization_id", organizationId);
    if (error) {
      return {
        error: operationalError("Tahsilat iptali tamamlanamadı", {
          rawMessage: error.message,
          code: diagnosticsCode("FIN", "cancel"),
        }),
      };
    }

    try {
      await logAuditEvent({
        organizationId,
        actorUserId: actor.id,
        actorRole: actor.role,
        action: "payment.record.cancel",
        entityType: "payment",
        entityId: paymentId,
        metadata: { reason },
      });
    } catch {
      /* best-effort */
    }
    await appendOperationalTimeline(adminClient, {
      organizationId,
      eventType: "payment.record.cancel",
      summary: `Tahsilat kaydı iptal: ${paymentId.slice(0, 8)}…`,
      payload: { paymentId },
      actorUserId: actor.id,
    });

    revalidatePath("/muhasebe-finans");
    return { success: true as const };
  });
}

/**
 * Canonical ödeme düzeltmesi: eski satır iptal + yeni satır (tutar farkı).
 * Paket ledger (`private_lesson_payments`) için `correctPrivateLessonLedgerPayment` kullanın.
 */
export async function correctPaymentRecord(formData: FormData) {
  return withServerActionGuard("payment.correctPaymentRecord", async () => {
    const gate = await assertFinanceAdmin(formData);
    if ("error" in gate) return { error: gate.error };
    const { actor, organizationId } = gate;

    const paymentId = formData.get("paymentId")?.toString().trim() || "";
    const reason = formData.get("reason")?.toString().trim() || "";
    const newAmountParsed = parseTRYMoneyInput(formData.get("newAmount")?.toString());
    if (!isUuid(paymentId)) return { error: "Geçersiz kayıt." };
    if (reason.length < 3) return { error: "Düzeltme nedeni zorunludur." };
    if (newAmountParsed == null) return { error: "Yeni tutar geçersiz." };
    const amtCheck = assertValidTRYMoneyAmount(newAmountParsed, "Yeni tutar");
    if (!amtCheck.ok) return { error: amtCheck.error };

    const adminClient = createSupabaseAdminClient();
    const { data: row } = await adminClient
      .from("payments")
      .select(
        "id, organization_id, profile_id, amount, payment_type, payment_scope, payment_kind, due_date, month_name, year_int, package_id, description, display_name, deleted_at"
      )
      .eq("id", paymentId)
      .maybeSingle();
    if (!row || row.organization_id !== organizationId) return { error: "Kayıt bulunamadı." };
    if (row.deleted_at) return { error: "İptal edilmiş kayıt düzeltilemez." };
    if (row.payment_kind === "private_lesson_package") {
      return { error: "Paket tahsilatı için paket defter düzeltmesi kullanın." };
    }

    const now = new Date().toISOString();
    const { error: delErr } = await adminClient
      .from("payments")
      .update({
        deleted_at: now,
        deleted_by: actor.id,
        delete_reason: `corrected: ${reason.slice(0, 1000)}`,
      })
      .eq("id", paymentId)
      .eq("organization_id", organizationId);
    if (delErr) {
      return {
        error: operationalError("Tahsilat kaydı iptal edilemedi", {
          rawMessage: delErr.message,
          code: diagnosticsCode("FIN", "cancel_legacy"),
        }),
      };
    }

    const desc =
      String(row.description || "").trim().length > 0
        ? `${String(row.description || "").slice(0, 500)} [düzeltme]`
        : "Tahsilat düzeltmesi";

    let insertModern = await adminClient
      .from("payments")
      .insert({
        profile_id: row.profile_id,
        organization_id: organizationId,
        amount: amtCheck.amount,
        payment_type: row.payment_type,
        payment_scope: row.payment_scope,
        payment_kind: row.payment_kind,
        due_date: row.due_date,
        month_name: row.month_name,
        year_int: row.year_int,
        package_id: row.package_id,
        description: desc,
        display_name: row.display_name,
        payment_date: now,
        status: "odendi",
        paid_at: now,
        metadata_json: { correction_of: paymentId, correction_reason: reason },
      })
      .select("id")
      .single();

    if (insertModern.error && isPaymentsSchemaCompatibilityError(insertModern.error.message)) {
      insertModern = await adminClient
        .from("payments")
        .insert({
          profile_id: row.profile_id,
          organization_id: organizationId,
          amount: amtCheck.amount,
          payment_type: row.payment_type,
          due_date: row.due_date,
          month_name: row.month_name,
          year_int: row.year_int,
          description: desc,
          payment_date: now,
          status: "odendi",
        })
        .select("id")
        .single();
    }

    const ins = insertModern.data;
    const insErr = insertModern.error;
    if (insErr || !ins?.id) {
      return {
        error: operationalError("Tahsilat düzeltmesi kaydedilemedi", {
          rawMessage: insErr?.message,
          code: diagnosticsCode("FIN", "correct"),
        }),
      };
    }

    try {
      await logAuditEvent({
        organizationId,
        actorUserId: actor.id,
        actorRole: actor.role,
        action: "payment.record.correct",
        entityType: "payment",
        entityId: ins.id as string,
        metadata: { previousId: paymentId, newAmount: amtCheck.amount, reason },
      });
    } catch {
      /* best-effort */
    }
    await appendOperationalTimeline(adminClient, {
      organizationId,
      eventType: "payment.record.correct",
      summary: "Tahsilat kaydı düzeltildi",
      payload: { previousId: paymentId, newId: ins.id },
      actorUserId: actor.id,
    });

    revalidatePath("/muhasebe-finans");
    return { success: true as const, newPaymentId: ins.id as string };
  });
}

export async function voidPrivateLessonLedgerPayment(formData: FormData) {
  return withServerActionGuard("payment.voidPrivateLessonLedgerPayment", async () => {
    const gate = await assertFinanceAdmin(formData);
    if ("error" in gate) return { error: gate.error };
    const { actor, organizationId } = gate;

    const plpId = formData.get("plpId")?.toString().trim() || "";
    const reason = formData.get("reason")?.toString().trim() || "";
    if (!isUuid(plpId)) return { error: "Geçersiz defter kaydı." };
    if (reason.length < 3) return { error: "İptal nedeni zorunludur." };

    const caps = await getSchemaCapabilities();
    const voidBlocked = ledgerVoidUnavailableMessage(caps);
    if (voidBlocked) return { error: voidBlocked };

    const adminClient = createSupabaseAdminClient();
    const { data: rpcRows, error: rpcErr } = await adminClient.rpc("private_lesson_void_ledger_payment_atomic", {
      p_plp_id: plpId,
      p_organization_id: organizationId,
      p_actor_id: actor.id,
      p_reason: reason,
    });
    if (rpcErr) {
      return {
        error: operationalError("Tahsilat iptali tamamlanamadı", {
          rawMessage: rpcErr.message,
          code: diagnosticsCode("FIN", "void"),
        }),
      };
    }
    const first = Array.isArray(rpcRows) && rpcRows[0] ? (rpcRows[0] as { out_package_id?: string }) : null;
    const packageId = first?.out_package_id || "";

    try {
      await logAuditEvent({
        organizationId,
        actorUserId: actor.id,
        actorRole: actor.role,
        action: "private_lesson_ledger.void",
        entityType: "private_lesson_package",
        entityId: packageId || plpId,
        metadata: { plpId, reason },
      });
    } catch {
      /* best-effort */
    }
    await appendOperationalTimeline(adminClient, {
      organizationId,
      eventType: "private_lesson_ledger.void",
      summary: "Paket tahsilat defteri iptal",
      payload: { plpId, packageId },
      actorUserId: actor.id,
    });

    revalidatePath("/muhasebe-finans");
    revalidatePath("/ozel-ders-paketleri");
    if (packageId) revalidatePath(`/ozel-ders-paketleri/${packageId}`);
    return { success: true as const, packageId };
  });
}

export async function correctPrivateLessonLedgerPayment(formData: FormData) {
  return withServerActionGuard("payment.correctPrivateLessonLedgerPayment", async () => {
    const gate = await assertFinanceAdmin(formData);
    if ("error" in gate) return { error: gate.error };
    const { actor, organizationId } = gate;

    const plpId = formData.get("plpId")?.toString().trim() || "";
    const reason = formData.get("reason")?.toString().trim() || "";
    const newAmountParsed = parseTRYMoneyInput(formData.get("newAmount")?.toString());
    if (!isUuid(plpId)) return { error: "Geçersiz defter kaydı." };
    if (reason.length < 3) return { error: "Düzeltme nedeni zorunludur." };
    if (newAmountParsed == null) return { error: "Yeni tutar geçersiz." };
    const amtCheck = assertValidTRYMoneyAmount(newAmountParsed, "Yeni tutar");
    if (!amtCheck.ok) return { error: amtCheck.error };

    const adminClient = createSupabaseAdminClient();
    const { data: rpcVoid, error: voidErr } = await adminClient.rpc("private_lesson_void_ledger_payment_atomic", {
      p_plp_id: plpId,
      p_organization_id: organizationId,
      p_actor_id: actor.id,
      p_reason: `correction_void: ${reason}`,
    });
    if (voidErr) {
      return {
        error: operationalError("Tahsilat iptali tamamlanamadı", {
          rawMessage: voidErr.message,
          code: diagnosticsCode("FIN", "void_legacy"),
        }),
      };
    }
    const pkgRow = Array.isArray(rpcVoid) && rpcVoid[0] ? (rpcVoid[0] as { out_package_id?: string }) : null;
    const packageId = pkgRow?.out_package_id || "";
    if (!isUuid(packageId)) return { error: "Paket çözümlenemedi." };

    const { data: pkg } = await adminClient
      .from("private_lesson_packages")
      .select("athlete_id")
      .eq("id", packageId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!pkg?.athlete_id) return { error: "Paket bulunamadı." };

    const paidAt = new Date().toISOString();
    const tz = await resolveOrganizationTimeZone(organizationId);
    const { dueDateKey, monthName, yearInt } = paymentBookkeepingFromPaidAtIso(paidAt, tz);
    const sync = await applyPrivateLessonPackagePaymentWithPaymentRow({
      organizationId,
      packageId,
      athleteProfileId: pkg.athlete_id as string,
      amount: amtCheck.amount,
      paidAtIso: paidAt,
      dueDateKey,
      monthName,
      yearInt,
      rpcActorProfileId: actor.id,
      paymentsDescription: `Düzeltme tahsilatı (önceki: ${plpId.slice(0, 8)})`,
      rpcNote: `Düzeltme: ${reason.slice(0, 500)}`,
    });
    if (!sync.ok) return { error: sync.error };

    try {
      await logAuditEvent({
        organizationId,
        actorUserId: actor.id,
        actorRole: actor.role,
        action: "payment.record.correct",
        entityType: "private_lesson_package",
        entityId: packageId,
        metadata: { voidedPlpId: plpId, newAmount: amtCheck.amount, reason },
      });
    } catch {
      /* best-effort */
    }

    revalidatePath("/muhasebe-finans");
    revalidatePath(`/ozel-ders-paketleri/${packageId}`);
    return { success: true as const, packageId };
  });
}
