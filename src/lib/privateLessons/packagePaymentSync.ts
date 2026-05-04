import "server-only";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { isUuid } from "@/lib/validation/uuid";
import { normalizeMoney } from "@/lib/privateLessons/packageMath";
import { isoToZonedDateKey, SCHEDULE_APP_TIME_ZONE } from "@/lib/schedule/scheduleWallTime";
import { isPaymentsSchemaCompatibilityError } from "@/lib/payments/paymentsSchemaCompatibility";

function resolveMonthNameTr(month: number) {
  return (
    [
      "Ocak",
      "Şubat",
      "Mart",
      "Nisan",
      "Mayıs",
      "Haziran",
      "Temmuz",
      "Ağustos",
      "Eylül",
      "Ekim",
      "Kasım",
      "Aralık",
    ][Math.max(0, Math.min(11, month - 1))] || "Ocak"
  );
}

/** Ödeme anı ISO timestamptz → payments.due_date / month_name / year_int (uygulama saat dilimi duvarı). */
export function paymentBookkeepingFromPaidAtIso(paidAtIso: string) {
  const tz = SCHEDULE_APP_TIME_ZONE;
  const paidWallKey = isoToZonedDateKey(paidAtIso, tz);
  const wallParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(paidWallKey);
  const wallMonth = wallParts ? Number(wallParts[2]) : new Date().getMonth() + 1;
  const wallYear = wallParts ? Number(wallParts[1]) : new Date().getFullYear();
  const monthName = resolveMonthNameTr(Number.isFinite(wallMonth) ? wallMonth : 1);
  const yearInt = Number.isFinite(wallYear) ? wallYear : new Date().getFullYear();
  const dueDateKey = paidWallKey || paidAtIso.slice(0, 10);
  return { dueDateKey, monthName, yearInt };
}

export type PackagePaymentSyncOk = {
  ok: true;
  paymentRowId: string;
  nextAmountPaid: number;
  paymentStatus: "unpaid" | "partial" | "paid";
  totalPrice: number;
  athleteId: string;
  packageName: string;
};

export type PackagePaymentSyncResult = PackagePaymentSyncOk | { ok: false; error: string };

export function revalidateAfterPrivateLessonPackagePayment(packageId: string) {
  revalidatePath("/muhasebe-finans");
  revalidatePath("/finans");
  revalidatePath("/ozel-ders-paketleri");
  revalidatePath(`/ozel-ders-paketleri/${packageId}`);
  revalidatePath("/antrenman-yonetimi");
}

/**
 * Özel ders paketi tahsilatı: tek akışta `payments` + `private_lesson_apply_payment_atomic`.
 * Sıra: önce `payments` (ödenmiş), RPC başarısızsa `payments` silinir — çift ledger veya yarım paket güncellemesi bırakılmaz.
 */
export async function applyPrivateLessonPackagePaymentWithPaymentRow(args: {
  organizationId: string;
  packageId: string;
  athleteProfileId: string;
  amount: number;
  paidAtIso: string;
  /** payments satırı için; boşsa paidAtIso üzerinden hesaplanır */
  dueDateKey?: string;
  monthName?: string;
  yearInt?: number;
  rpcActorProfileId: string;
  paymentsDescription: string | null;
  rpcNote: string;
}): Promise<PackagePaymentSyncResult> {
  const organizationId = args.organizationId.trim();
  const packageId = args.packageId.trim();
  const athleteProfileId = args.athleteProfileId.trim();
  if (!isUuid(organizationId) || !isUuid(packageId) || !isUuid(athleteProfileId)) {
    return { ok: false, error: "Geçersiz ödeme parametreleri." };
  }
  if (!isUuid(args.rpcActorProfileId)) {
    return { ok: false, error: "Geçersiz işlem yapan profil." };
  }

  const amount = normalizeMoney(args.amount);
  if (amount <= 0) return { ok: false, error: "Tahsilat tutarı sıfırdan büyük olmalı." };

  const adminClient = createSupabaseAdminClient();
  const { data: pkg, error: pkgErr } = await adminClient
    .from("private_lesson_packages")
    .select("id, organization_id, athlete_id, coach_id, total_price, amount_paid, is_active, package_name")
    .eq("id", packageId)
    .maybeSingle();

  if (pkgErr || !pkg) return { ok: false, error: "Paket bulunamadı." };
  if (pkg.organization_id !== organizationId) return { ok: false, error: "Paket bu organizasyona ait değil." };
  if (pkg.athlete_id !== athleteProfileId) return { ok: false, error: "Paket bu sporcuya ait değil." };
  if (!pkg.is_active) return { ok: false, error: "Pasif paket için tahsilat eklenemez." };

  const { data: athlete } = await adminClient
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", athleteProfileId)
    .maybeSingle();
  if (!athlete || getSafeRole(athlete.role) !== "sporcu" || athlete.organization_id !== organizationId) {
    return { ok: false, error: "Sporcu bu organizasyonda bulunamadı." };
  }

  const totalPrice = normalizeMoney(pkg.total_price);
  const alreadyPaid = normalizeMoney(pkg.amount_paid);
  const remainingDue = normalizeMoney(totalPrice - alreadyPaid);
  if (totalPrice > 0 && amount > remainingDue + 0.001) {
    return {
      ok: false,
      error: `Bu paket için en fazla ₺${remainingDue.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} tahsilat girebilirsiniz.`,
    };
  }

  const period =
    args.dueDateKey && args.monthName != null && args.yearInt != null
      ? { dueDateKey: args.dueDateKey, monthName: args.monthName, yearInt: args.yearInt }
      : paymentBookkeepingFromPaidAtIso(args.paidAtIso);

  const paymentKind = "private_lesson_package";
  const paymentScope = "private_lesson";
  const paymentType = "paket";

  let insertRes = await adminClient
    .from("payments")
    .insert({
      profile_id: athleteProfileId,
      organization_id: organizationId,
      amount,
      payment_type: paymentType,
      payment_scope: paymentScope,
      payment_kind: paymentKind,
      due_date: period.dueDateKey,
      month_name: period.monthName,
      year_int: period.yearInt,
      payment_date: args.paidAtIso,
      status: "odendi",
      description: args.paymentsDescription,
      package_id: packageId,
      paid_at: args.paidAtIso,
    })
    .select("id")
    .single();

  if (insertRes.error && isPaymentsSchemaCompatibilityError(insertRes.error.message)) {
    insertRes = await adminClient
      .from("payments")
      .insert({
        profile_id: athleteProfileId,
        organization_id: organizationId,
        amount,
        payment_type: paymentType,
        due_date: period.dueDateKey,
        month_name: period.monthName,
        year_int: period.yearInt,
        payment_date: args.paidAtIso,
        status: "odendi",
        description: args.paymentsDescription,
      })
      .select("id")
      .single();
  }

  if (insertRes.error || !insertRes.data?.id) {
    return { ok: false, error: "Tahsilat kaydı oluşturulamadı. Lütfen tekrar deneyin veya yöneticinize bildirin." };
  }

  const paymentRowId = insertRes.data.id as string;
  const coachId = (pkg.coach_id as string | null) || null;

  const { data: atomicRows, error: atomicErr } = await adminClient.rpc("private_lesson_apply_payment_atomic", {
    p_package_id: packageId,
    p_organization_id: organizationId,
    p_actor_id: args.rpcActorProfileId,
    p_fallback_coach_id: coachId,
    p_payment_amount: amount,
    p_paid_at: args.paidAtIso,
    p_note: args.rpcNote,
  });

  if (atomicErr || !Array.isArray(atomicRows) || atomicRows.length === 0) {
    await adminClient.from("payments").delete().eq("id", paymentRowId).eq("organization_id", organizationId);
    return { ok: false, error: atomicErr?.message || "Paket ödemesi güncellenemedi." };
  }

  const atomicRow = atomicRows[0] as {
    next_amount_paid?: number;
    payment_status?: string;
    total_price?: number;
    package_name?: string;
    athlete_id?: string;
  };

  revalidateAfterPrivateLessonPackagePayment(packageId);

  return {
    ok: true,
    paymentRowId,
    nextAmountPaid: Number(atomicRow.next_amount_paid ?? 0),
    paymentStatus: (atomicRow.payment_status ?? "unpaid") as "unpaid" | "partial" | "paid",
    totalPrice: Number(atomicRow.total_price ?? pkg.total_price ?? 0),
    athleteId: String(atomicRow.athlete_id ?? pkg.athlete_id ?? ""),
    packageName: String(atomicRow.package_name ?? pkg.package_name ?? "Özel ders paketi"),
  };
}
