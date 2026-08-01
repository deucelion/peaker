/**
 * Faz 12.4 — Payments CSV streaming HTTP route.
 *
 * Davranış parity (`exportAccountingFinancePaymentsCSV` action ile):
 *   - Aynı header sırası, aynı label fonksiyonları, aynı cap (10000).
 *   - Aynı rate limit policy (`export.accounting`).
 *   - Modern payments schema (latest migrations applied). Eski schema'da
 *     400 + fallback öneri mesajı (sync action hâlâ multi-strategy fallback
 *     yapıyor, kullanıcıyı oraya yönlendirir).
 *
 * Streaming kazancı:
 *   - 10000 satır × 13 col ≈ 5MB CSV → Vercel 4.5MB body limiti aşılırdı;
 *     streaming response body chunked transfer ile bu limit yok.
 *   - İlk byte hızlı; client erken indirme başlatır.
 *
 * Güvenlik:
 *   - Session actor + role (admin / super_admin) + org scope.
 *   - service-role admin client query'si explicit `organization_id` eq ile
 *     RLS-equivalent kontrol.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { isUuid } from "@/lib/validation/uuid";
import { toDisplayName } from "@/lib/profile/displayName";
import { csvFilename } from "@/lib/export/csv";
import { buildCsvDownloadHeaders } from "@/lib/export/exportHttpHeaders";
import { streamCsvToResponse, chunkedCsvIterable } from "@/lib/export/csvStreamIterable";
import {
  getAccountingPaymentKindLabel,
  getAccountingPaymentScopeLabel,
  getAccountingPaymentStatusLabel,
} from "@/lib/accountingFinance/labels";
import { ensureRateLimitSetup } from "@/lib/rateLimit";
import { checkExportRateLimitAsync, formatRateLimitRetryMessage } from "@/lib/rateLimit/exportRateLimit";
import { logger } from "@/lib/monitoring/logger";
import { reportExportRun, reportExportStreamTerminal } from "@/lib/monitoring/advancedTelemetry";
import { assertExportFeatureForOrg } from "@/lib/auth/exportFeatureAccess";
import { EXPORT_ENDPOINT_IDS } from "@/lib/organization/features/surfaces/exportEntitlementMap";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAYMENTS_EXPORT_HARD_CAP = 10000;

ensureRateLimitSetup();

type PaymentRowDb = {
  id: string;
  athlete_id: string | null;
  amount: number | string | null;
  paid_amount: number | string | null;
  payment_date: string | null;
  due_date: string | null;
  status: "bekliyor" | "odendi" | null;
  payment_kind: string | null;
  payment_scope: string | null;
  description: string | null;
  channel: string | null;
  source_label: string | null;
  package_id: string | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
};

function jsonError(message: string, status: number, extras?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extras }, { status });
}

function formatTrDate(iso: string | null): string {
  if (!iso) return "";
  const dateOnly = iso.length >= 10 ? iso.slice(0, 10) : iso;
  if (!/^\d{4}-\d{2}-\d{2}/.test(dateOnly)) return iso;
  const [y, m, d] = dateOnly.split("-");
  return `${d}.${m}.${y}`;
}

export async function GET(request: Request) {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: false });
  if ("error" in resolved) {
    return jsonError(resolved.error, 401, { errorKind: "auth_required" });
  }
  const role = getSafeRole(resolved.actor.role);
  if (role !== "admin" && role !== "super_admin") {
    return jsonError("Tahsilat kayıtlarını dışa aktarma yetkiniz yok.", 403, {
      errorKind: "permission_denied",
    });
  }

  const url = new URL(request.url);
  const wantOrg = (url.searchParams.get("organizationId") || "").trim();
  let scopeOrg: string | null = null;
  if (role === "admin") {
    if (!resolved.actor.organizationId) {
      return jsonError("Organizasyon bilgisi alınamadı.", 401, { errorKind: "auth_required" });
    }
    scopeOrg = resolved.actor.organizationId;
  } else if (wantOrg) {
    if (!isUuid(wantOrg)) {
      return jsonError("Geçersiz organizasyon filtresi.", 400, { errorKind: "invalid_input" });
    }
    scopeOrg = wantOrg;
  }
  if (!scopeOrg) {
    return jsonError("Tahsilat dışa aktarımı için organizasyon belirtilmeli.", 400, {
      errorKind: "invalid_input",
    });
  }

  const featureDenial = await assertExportFeatureForOrg(EXPORT_ENDPOINT_IDS.paymentsStream, scopeOrg);
  if (featureDenial) {
    return jsonError(featureDenial.error, 403, { errorKind: featureDenial.errorKind });
  }

  const dateFrom = (url.searchParams.get("dateFrom") || "").trim();
  const dateTo = (url.searchParams.get("dateTo") || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    return jsonError("dateFrom ve dateTo YYYY-MM-DD formatında olmalı.", 400, {
      errorKind: "invalid_input",
    });
  }
  if (dateFrom > dateTo) {
    return jsonError("Başlangıç tarihi bitiş tarihinden sonra olamaz.", 400, {
      errorKind: "invalid_input",
    });
  }

  const paymentStatusRaw = (url.searchParams.get("paymentStatus") || "all").trim();
  const paymentStatus: "all" | "bekliyor" | "odendi" =
    paymentStatusRaw === "bekliyor" || paymentStatusRaw === "odendi"
      ? paymentStatusRaw
      : "all";
  const paymentKind = (url.searchParams.get("paymentKind") || "").trim() || null;

  const decision = await checkExportRateLimitAsync({
    userId: resolved.actor.id,
    organizationId: scopeOrg,
    exportKind: "accounting",
  });
  if (!decision.allowed) {
    return NextResponse.json(
      {
        error: formatRateLimitRetryMessage(decision, "accounting"),
        errorKind: "rate_limited",
        retryAfterMs: decision.retryAfterMs,
        retryAfterSeconds: Math.max(1, Math.ceil(decision.retryAfterMs / 1000)),
        adapter: decision.adapter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000))),
        },
      }
    );
  }

  const adminClient = createSupabaseAdminClient();
  const fromIso = new Date(`${dateFrom}T00:00:00.000Z`).toISOString();
  const toExclusiveIso = new Date(
    new Date(`${dateTo}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000
  ).toISOString();

  let q = adminClient
    .from("payments")
    .select(
      "id, athlete_id, amount, paid_amount, payment_date, due_date, status, payment_kind, payment_scope, description, channel, source_label, package_id, profiles!athlete_id(full_name, email)"
    )
    .eq("organization_id", scopeOrg)
    .is("deleted_at", null)
    .gte("payment_date", fromIso)
    .lt("payment_date", toExclusiveIso)
    .order("payment_date", { ascending: false })
    .limit(PAYMENTS_EXPORT_HARD_CAP);
  if (paymentStatus !== "all") q = q.eq("status", paymentStatus);
  if (paymentKind) q = q.eq("payment_kind", paymentKind);

  const { data, error } = await q;
  if (error) {
    logger.warn("export.payments.stream", "query failed", { reason: error.message });
    return jsonError(
      `Tahsilat kayıtları alınamadı: ${error.message}. (Eski schema'da sync export kullanın.)`,
      500,
      { errorKind: "fetch_error" }
    );
  }

  const rows = (data ?? []) as PaymentRowDb[];

  const headers = [
    "Tahsilat Tarihi",
    "Vade Tarihi",
    "Sporcu",
    "Durum",
    "Tutar (TL)",
    "Ödenen (TL)",
    "Kalan (TL)",
    "Ödeme Türü",
    "Kapsam",
    "Açıklama",
    "Kanal",
    "Kaynak",
    "Paket ID",
  ];

  const mapRow = (p: PaymentRowDb): ReadonlyArray<unknown> => {
    const amount = Number(p.amount ?? 0) || 0;
    const paidAmount = Number(p.paid_amount ?? 0) || 0;
    const remaining = p.status === "odendi" ? amount - paidAmount : null;
    const athleteName = toDisplayName(
      p.profiles?.full_name ?? null,
      p.profiles?.email ?? null,
      "Sporcu"
    );
    return [
      formatTrDate(p.payment_date),
      formatTrDate(p.due_date),
      athleteName,
      getAccountingPaymentStatusLabel((p.status ?? "bekliyor") as "bekliyor" | "odendi"),
      amount,
      paidAmount,
      remaining != null ? remaining : "",
      getAccountingPaymentKindLabel(p.payment_kind),
      getAccountingPaymentScopeLabel(p.payment_scope),
      String(p.description ?? ""),
      String(p.channel ?? ""),
      String(p.source_label ?? ""),
      p.package_id ?? "",
    ];
  };

  const filename = csvFilename("muhasebe", "tahsilat", {
    from: dateFrom,
    to: dateTo,
    status: paymentStatus === "all" ? null : paymentStatus,
  });

  const iterable = chunkedCsvIterable(async () => rows, mapRow, 500);
  const streamStartedAt = Date.now();
  const As = AbortSignal as unknown as {
    any?: (signals: AbortSignal[]) => AbortSignal;
    timeout?: (ms: number) => AbortSignal;
  };
  const maxStreamMs = 120_000;
  let streamSignal: AbortSignal = request.signal;
  let timeoutSig: AbortSignal | null = null;
  if (typeof As.timeout === "function" && typeof As.any === "function") {
    timeoutSig = As.timeout(maxStreamMs);
    streamSignal = As.any([request.signal, timeoutSig]);
  }

  const stream = streamCsvToResponse(headers, iterable, { maxRows: PAYMENTS_EXPORT_HARD_CAP }, {
    signal: streamSignal,
    onProgress: ({ rowsEmitted }) => {
      if (rowsEmitted > 0 && rowsEmitted % 500 === 0) {
        logger.info("export.payments.stream", "chunk progress", {
          rowsEmitted,
          organizationId: scopeOrg,
        });
      }
    },
    onComplete: (info) => {
      const durationMs = Date.now() - streamStartedAt;
      logger.info("export.payments.stream", "stream completed", {
        organizationId: scopeOrg,
        actorRole: role,
        rowCount: info.rowCount,
        truncated: info.truncated,
        cap: info.cap ?? PAYMENTS_EXPORT_HARD_CAP,
        durationMs,
        paymentStatus,
      });
      reportExportRun({
        exportKind: "accounting",
        organizationId: scopeOrg,
        rowCount: info.rowCount,
        bytes: null,
        durationMs,
        truncated: info.truncated,
        source: "stream",
      });
    },
    onAbort: (info) => {
      const durationMs = Date.now() - streamStartedAt;
      const timedOut = Boolean(timeoutSig?.aborted && !request.signal.aborted);
      const base = {
        exportKind: "accounting",
        organizationId: scopeOrg,
        rowCountEmitted: info.rowCount,
        durationMs,
        truncated: info.truncated,
      };
      if (timedOut) {
        reportExportStreamTerminal({ kind: "export_timeout", ...base });
      } else if (request.signal.aborted) {
        if (info.rowCount > 0 && !info.truncated) {
          reportExportStreamTerminal({ kind: "export_partial_stream", ...base });
          reportExportStreamTerminal({ kind: "export_client_disconnect", ...base });
        } else {
          reportExportStreamTerminal({ kind: "export_aborted", ...base });
        }
      }
    },
  });

  logger.info("export.payments.stream", "stream initiated", {
    organizationId: scopeOrg,
    actorRole: role,
    rateLimitAdapter: decision.adapter,
    queryRowCount: rows.length,
    paymentStatus,
  });

  const willTruncate = rows.length >= PAYMENTS_EXPORT_HARD_CAP;

  return new Response(stream, {
    status: 200,
    headers: buildCsvDownloadHeaders(filename, {
      rowCount: rows.length,
      cap: PAYMENTS_EXPORT_HARD_CAP,
      truncated: willTruncate,
    }),
  });
}
