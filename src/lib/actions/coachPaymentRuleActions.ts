"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { isUuid } from "@/lib/validation/uuid";

function resolveOrgIdForRuleAction(actorOrg: string, role: string, formOrg: string): string | { error: string } {
  if (role === "admin") {
    if (!actorOrg) return { error: "Organizasyon bilgisi alınamadı." };
    return actorOrg;
  }
  if (role === "super_admin") {
    const q = (formOrg || "").trim();
    if (!isUuid(q)) return { error: "Super admin için organizationId zorunludur." };
    return q;
  }
  return { error: "Bu işlem için yetkiniz yok." };
}

export type CoachPaymentRuleRow = {
  id: string;
  organization_id: string;
  coach_id: string;
  payment_type: "per_lesson" | "percentage";
  amount: number | null;
  percentage: number | null;
  applies_to: "group" | "private" | "all";
  created_at: string;
  updated_at: string;
};

export async function listCoachPaymentRulesForAccounting(orgIdFromClient: string | null) {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: false });
  if ("error" in resolved) return { error: resolved.error };
  const role = String(getSafeRole(resolved.actor.role));
  const orgResolved = resolveOrgIdForRuleAction(resolved.actor.organizationId || "", role, orgIdFromClient || "");
  if (typeof orgResolved !== "string") return orgResolved;

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("coach_payment_rules")
    .select("id, organization_id, coach_id, payment_type, amount, percentage, applies_to, created_at, updated_at")
    .eq("organization_id", orgResolved)
    .order("coach_id", { ascending: true })
    .order("applies_to", { ascending: true });

  if (error) {
    if (error.message?.includes("coach_payment_rules") || error.code === "42P01") {
      return { rules: [] as CoachPaymentRuleRow[] };
    }
    return { error: `Koç ödeme kuralları alınamadı: ${error.message}` };
  }
  return { rules: (data || []) as CoachPaymentRuleRow[] };
}

export async function upsertCoachPaymentRule(formData: FormData) {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: false });
  if ("error" in resolved) return { error: resolved.error };
  const role = String(getSafeRole(resolved.actor.role));
  if (role !== "admin" && role !== "super_admin") {
    return { error: "Bu işlem yalnızca yönetici tarafından yapılabilir." };
  }

  const orgResolved = resolveOrgIdForRuleAction(
    resolved.actor.organizationId || "",
    role,
    formData.get("organizationId")?.toString() || ""
  );
  if (typeof orgResolved !== "string") return orgResolved;

  const coachId = formData.get("coachId")?.toString().trim() || "";
  if (!isUuid(coachId)) return { error: "Geçersiz koç." };

  const appliesTo = formData.get("appliesTo")?.toString().trim() as "group" | "private" | "all";
  if (appliesTo !== "group" && appliesTo !== "private" && appliesTo !== "all") {
    return { error: "Geçersiz ders kapsamı." };
  }

  const paymentType = formData.get("paymentType")?.toString().trim() as "per_lesson" | "percentage";
  if (paymentType !== "per_lesson" && paymentType !== "percentage") {
    return { error: "Geçersiz ödeme tipi." };
  }

  const amountRaw = formData.get("amount")?.toString().trim();
  const pctRaw = formData.get("percentage")?.toString().trim();
  let amount: number | null = null;
  let percentage: number | null = null;

  if (paymentType === "per_lesson") {
    const n = amountRaw ? Number(amountRaw) : NaN;
    if (!Number.isFinite(n) || n <= 0) return { error: "Ders başı tutar zorunludur." };
    amount = n;
  } else {
    const n = pctRaw ? Number(pctRaw) : NaN;
    if (!Number.isFinite(n) || n < 0 || n > 100) return { error: "Yüzde 0–100 arasında olmalıdır." };
    percentage = n;
  }

  const adminClient = createSupabaseAdminClient();
  const { data: coachRow } = await adminClient
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", coachId)
    .maybeSingle();
  if (!coachRow || getSafeRole(coachRow.role) !== "coach" || coachRow.organization_id !== orgResolved) {
    return { error: "Koç bu organizasyonda bulunamadı." };
  }

  const now = new Date().toISOString();
  const { error } = await adminClient.from("coach_payment_rules").upsert(
    {
      organization_id: orgResolved,
      coach_id: coachId,
      applies_to: appliesTo,
      payment_type: paymentType,
      amount,
      percentage,
      updated_at: now,
    },
    { onConflict: "organization_id,coach_id,applies_to" }
  );

  if (error) {
    return { error: `Kural kaydedilemedi: ${error.message}` };
  }

  revalidatePath("/muhasebe-finans");
  return { success: true as const };
}
