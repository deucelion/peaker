/**
 * Faz 19 — Alacak / borç CSV streaming (paket ve sporcu bazlı).
 * Güvenlik ve rate limit: tahsilat export ile aynı politika.
 */

import { NextResponse } from "next/server";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { isUuid } from "@/lib/validation/uuid";
import { csvFilename } from "@/lib/export/csv";
import { buildCsvDownloadHeaders } from "@/lib/export/exportHttpHeaders";
import { streamCsvToResponse, chunkedCsvIterable } from "@/lib/export/csvStreamIterable";
import { ensureRateLimitSetup } from "@/lib/rateLimit";
import { checkExportRateLimitAsync, formatRateLimitRetryMessage } from "@/lib/rateLimit/exportRateLimit";
import { logger } from "@/lib/monitoring/logger";
import { reportExportRun, reportExportStreamTerminal } from "@/lib/monitoring/advancedTelemetry";
import { loadReceivablesDashboard } from "@/lib/actions/receivableDashboardActions";
import { RECEIVABLE_STATUS_LABEL_TR, type ReceivableComputedStatus } from "@/lib/finance/receivableStatus";
import type { PackageLifecycleStatus } from "@/lib/privateLessons/packageStatus";
import { assertExportFeatureForOrg } from "@/lib/auth/exportFeatureAccess";
import { EXPORT_ENDPOINT_IDS } from "@/lib/organization/features/surfaces/exportEntitlementMap";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXPORT_CAP = 10000;

ensureRateLimitSetup();

function jsonError(message: string, status: number, extras?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extras }, { status });
}

export async function GET(request: Request) {
  const resolved = await resolveSessionActor({ claimRequiresOrganization: false });
  if ("error" in resolved) {
    return jsonError(resolved.error, 401, { errorKind: "auth_required" });
  }
  const role = getSafeRole(resolved.actor.role);
  if (role !== "admin" && role !== "super_admin") {
    return jsonError("Bu dışa aktarım için yetkiniz yok.", 403, { errorKind: "permission_denied" });
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
    return jsonError("Dışa aktarım için organizasyon belirtilmeli.", 400, { errorKind: "invalid_input" });
  }

  const featureDenial = await assertExportFeatureForOrg(EXPORT_ENDPOINT_IDS.receivablesStream, scopeOrg);
  if (featureDenial) {
    return jsonError(featureDenial.error, 403, { errorKind: featureDenial.errorKind });
  }

  const kindRaw = (url.searchParams.get("kind") || "packages").trim();
  const kind = kindRaw === "overdue" || kindRaw === "athletes" || kindRaw === "packages" ? kindRaw : "packages";

  const dateFrom = (url.searchParams.get("dateFrom") || "").trim();
  const dateTo = (url.searchParams.get("dateTo") || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    return jsonError("dateFrom ve dateTo YYYY-MM-DD formatında olmalı.", 400, { errorKind: "invalid_input" });
  }
  if (dateFrom > dateTo) {
    return jsonError("Başlangıç tarihi bitiş tarihinden sonra olamaz.", 400, { errorKind: "invalid_input" });
  }

  const monthKey = dateFrom.slice(0, 7);
  const athleteId = (url.searchParams.get("athleteId") || "").trim() || undefined;
  const teamContains = (url.searchParams.get("teamContains") || "").trim() || undefined;
  const packageLifecycle = ((url.searchParams.get("packageLifecycle") || "all").trim() || "all") as
    | "all"
    | PackageLifecycleStatus;
  const pkgPaymentStatus = ((url.searchParams.get("pkgPaymentStatus") || "all").trim() || "all") as
    | "all"
    | "unpaid"
    | "partial"
    | "paid";
  const receivableState = ((url.searchParams.get("receivableState") || "all").trim() || "all") as
    | "all"
    | ReceivableComputedStatus;

  const decision = await checkExportRateLimitAsync({
    userId: resolved.actor.id,
    organizationId: scopeOrg,
    exportKind: "receivables",
  });
  if (!decision.allowed) {
    return NextResponse.json(
      {
        error: formatRateLimitRetryMessage(decision, "receivables"),
        errorKind: "rate_limited",
        retryAfterMs: decision.retryAfterMs,
      },
      {
        status: 429,
        headers: { "Retry-After": String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000))) },
      }
    );
  }

  const dashRes = await loadReceivablesDashboard({
    orgId: role === "super_admin" ? scopeOrg : undefined,
    month: monthKey,
    dateFrom,
    dateTo,
    athleteId: athleteId && isUuid(athleteId) ? athleteId : undefined,
    teamContains,
    packageLifecycle,
    pkgPaymentStatus,
    receivableState,
  });

  if ("error" in dashRes) {
    return jsonError(dashRes.error, 400, { errorKind: "fetch_error" });
  }
  const snap = dashRes.snapshot;

  type Row = ReadonlyArray<unknown>;
  let headers: string[] = [];
  let rows: Row[] = [];

  if (kind === "athletes") {
    headers = ["Sporcu ID", "Sporcu", "Takım", "Paket sayısı", "Toplam kalan (TL)", "En kritik durum"];
    rows = snap.athleteDebts.slice(0, EXPORT_CAP).map((a) => [
      a.athleteId,
      a.athleteName,
      a.team || "",
      a.packageCount,
      a.totalRemaining,
      RECEIVABLE_STATUS_LABEL_TR[a.worstReceivableStatus],
    ]);
  } else if (kind === "overdue") {
    headers = ["Paket ID", "Paket", "Sporcu", "Takım", "Kalan (TL)", "Vade", "Gecikme gün", "Durum"];
    rows = snap.packageRows
      .filter((r) => r.receivableStatus === "overdue")
      .slice(0, EXPORT_CAP)
      .map((r) => [
        r.packageId,
        r.packageName,
        r.athleteName,
        r.athleteTeam || "",
        r.remainingBalance,
        r.nextPaymentDueAt ? r.nextPaymentDueAt.slice(0, 10) : "",
        r.daysOverdue ?? "",
        r.receivableLabel,
      ]);
  } else {
    headers = [
      "Paket ID",
      "Paket",
      "Sporcu",
      "Takım",
      "Toplam (TL)",
      "Alınan (TL)",
      "Kalan (TL)",
      "Vade",
      "Alacak durumu",
      "Paket durumu",
    ];
    rows = snap.packageRows
      .filter((r) => r.remainingBalance > 0.001)
      .slice(0, EXPORT_CAP)
      .map((r) => [
        r.packageId,
        r.packageName,
        r.athleteName,
        r.athleteTeam || "",
        r.totalPrice,
        r.amountPaid,
        r.remainingBalance,
        r.nextPaymentDueAt ? r.nextPaymentDueAt.slice(0, 10) : "",
        r.receivableLabel,
        r.lifecycleStatus,
      ]);
  }

  const filename = csvFilename("muhasebe", `alacak-${kind}`, { from: dateFrom, to: dateTo });

  const iterable = chunkedCsvIterable(async () => rows, (r) => r, 400);
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

  const stream = streamCsvToResponse(headers, iterable, { maxRows: EXPORT_CAP }, {
    signal: streamSignal,
    onComplete: (info) => {
      reportExportRun({
        exportKind: "receivables",
        organizationId: scopeOrg,
        rowCount: info.rowCount,
        bytes: null,
        durationMs: Date.now() - streamStartedAt,
        truncated: info.truncated,
        source: "stream",
      });
    },
    onAbort: (info) => {
      const timedOut = Boolean(timeoutSig?.aborted && !request.signal.aborted);
      const base = {
        exportKind: "receivables",
        organizationId: scopeOrg,
        rowCountEmitted: info.rowCount,
        durationMs: Date.now() - streamStartedAt,
        truncated: info.truncated,
      };
      if (timedOut) reportExportStreamTerminal({ kind: "export_timeout", ...base });
      else if (request.signal.aborted) reportExportStreamTerminal({ kind: "export_aborted", ...base });
    },
  });

  logger.info("export.receivables.stream", "stream initiated", {
    organizationId: scopeOrg,
    kind,
    rowCount: rows.length,
  });

  const willTruncate = rows.length >= EXPORT_CAP;

  return new Response(stream, {
    status: 200,
    headers: buildCsvDownloadHeaders(filename, { rowCount: rows.length, cap: EXPORT_CAP, truncated: willTruncate }),
  });
}
