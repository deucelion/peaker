/**
 * Faz 12.4 — Audit log CSV streaming HTTP route.
 *
 * Davranış parity (`exportAuditLogsCSV` action ile):
 *   - Aynı header sırası, aynı filtre kuralları, aynı cap (5000).
 *   - Aynı rate limit policy (`export.audit`).
 *   - Aynı CSV format: UTF-8 BOM + ; separator + CRLF + RFC 4180 quoting.
 *
 * Streaming kazancı:
 *   - Response body chunked transfer; client ilk byte'ı hızlı alır.
 *   - Memory burst yok; 5000 satır cap'inde RAM kullanımı ~stable.
 *   - Vercel response size limiti 4.5MB → 5000 satır × 200B = 1MB güvenli.
 *
 * Güvenlik:
 *   - Aynı role kontrolü: admin (kendi org) veya super_admin (opsiyonel org).
 *   - withServerActionGuard sync action'a özgü; route handler'da manuel
 *     auth + structured log.
 *
 * Headers (downloaded-safe):
 *   - Content-Type: text/csv; charset=utf-8
 *   - Content-Disposition: attachment; filename="..."
 *   - X-Peaker-Row-Count, X-Peaker-Truncated (caller bilgi için)
 *
 * Abort:
 *   - Client connection drop'unda iterable durur (Next.js context).
 *   - Telemetry: tamamlanmazsa "aborted" log.
 */

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { isUuid } from "@/lib/validation/uuid";
import { toDisplayName } from "@/lib/profile/displayName";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  type AuditAction,
  type AuditEntityType,
} from "@/lib/audit/types";
import { auditDateEndIso, auditDateStartIso } from "@/lib/audit/auditQueryRange";
import { csvFilename } from "@/lib/export/csv";
import { buildCsvDownloadHeaders } from "@/lib/export/exportHttpHeaders";
import { streamCsvToResponse, chunkedCsvIterable } from "@/lib/export/csvStreamIterable";
import { ensureRateLimitSetup } from "@/lib/rateLimit";
import { checkExportRateLimitAsync, formatRateLimitRetryMessage } from "@/lib/rateLimit/exportRateLimit";
import { logger } from "@/lib/monitoring/logger";
import { reportExportRun, reportExportStreamTerminal } from "@/lib/monitoring/advancedTelemetry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const AUDIT_EXPORT_HARD_CAP = 5000;

ensureRateLimitSetup();

function isIsoLike(v: string | null | undefined): boolean {
  if (!v) return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime());
}

function parseFilters(url: URL): {
  organizationId?: string | null;
  action?: string | null;
  entityType?: string | null;
  fromIso?: string | null;
  toIso?: string | null;
} {
  const get = (k: string) => url.searchParams.get(k);
  return {
    organizationId: get("organizationId"),
    action: get("action"),
    entityType: get("entityType"),
    fromIso: get("fromIso"),
    toIso: get("toIso"),
  };
}

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
    return jsonError("Audit kayıtlarını dışa aktarma yetkiniz yok.", 403, {
      errorKind: "permission_denied",
    });
  }

  const url = new URL(request.url);
  const filters = parseFilters(url);

  let scopeOrg: string | null = null;
  if (role === "admin") {
    if (!resolved.actor.organizationId) {
      return jsonError("Organizasyon bilgisi alınamadı.", 401, { errorKind: "auth_required" });
    }
    scopeOrg = resolved.actor.organizationId;
  } else {
    const wantOrg = (filters.organizationId || "").trim();
    if (wantOrg && !isUuid(wantOrg)) {
      return jsonError("Geçersiz organizasyon filtresi.", 400, { errorKind: "invalid_input" });
    }
    scopeOrg = wantOrg || null;
  }

  // Rate limit — sync action ile aynı policy, async adapter (distributed-safe).
  const decision = await checkExportRateLimitAsync({
    userId: resolved.actor.id,
    organizationId: scopeOrg ?? "global",
    exportKind: "audit",
  });
  if (!decision.allowed) {
    return NextResponse.json(
      {
        error: formatRateLimitRetryMessage(decision, "audit"),
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

  const wantedAction = (filters.action || "").trim();
  const wantedEntity = (filters.entityType || "").trim();
  const wantedFrom = (filters.fromIso || "").trim();
  const wantedTo = (filters.toIso || "").trim();
  if (wantedAction && !AUDIT_ACTIONS.includes(wantedAction as AuditAction)) {
    return jsonError("Geçersiz audit eylem filtresi.", 400, { errorKind: "invalid_input" });
  }
  if (wantedEntity && !AUDIT_ENTITY_TYPES.includes(wantedEntity as AuditEntityType)) {
    return jsonError("Geçersiz audit entity filtresi.", 400, { errorKind: "invalid_input" });
  }
  if (wantedFrom && !isIsoLike(wantedFrom)) {
    return jsonError("Geçersiz başlangıç tarihi.", 400, { errorKind: "invalid_input" });
  }
  if (wantedTo && !isIsoLike(wantedTo)) {
    return jsonError("Geçersiz bitiş tarihi.", 400, { errorKind: "invalid_input" });
  }

  const adminClient = createSupabaseAdminClient();
  let q = adminClient
    .from("audit_logs")
    .select("id, organization_id, user_id, role, action, entity_type, entity_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(AUDIT_EXPORT_HARD_CAP);
  if (scopeOrg) q = q.eq("organization_id", scopeOrg);
  if (wantedAction) q = q.eq("action", wantedAction);
  if (wantedEntity) q = q.eq("entity_type", wantedEntity);
  if (wantedFrom) q = q.gte("created_at", auditDateStartIso(wantedFrom));
  if (wantedTo) q = q.lte("created_at", auditDateEndIso(wantedTo));

  const { data, error } = await q;
  if (error) {
    logger.warn("export.audit.stream", "query failed", { reason: error.message });
    return jsonError(`Audit kayıtları alınamadı: ${error.message}`, 500, {
      errorKind: "fetch_error",
    });
  }

  const rows = data ?? [];
  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
  let actorMap = new Map<string, { full_name: string | null; email: string | null }>();
  if (userIds.length > 0) {
    const { data: actors } = await adminClient
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);
    actorMap = new Map(
      (actors || []).map((p) => [p.id, { full_name: p.full_name, email: p.email }])
    );
  }

  const headers = [
    "Tarih (ISO)",
    "Aktör",
    "Rol",
    "Eylem",
    "Entity Türü",
    "Entity ID",
    "Organizasyon ID",
    "Metadata (JSON)",
  ];

  const mapRow = (row: (typeof rows)[number]): ReadonlyArray<unknown> => {
    const a = actorMap.get(row.user_id);
    const actorName = toDisplayName(a?.full_name ?? null, a?.email ?? null, "Kullanıcı");
    const metaJson =
      row.metadata && typeof row.metadata === "object" ? JSON.stringify(row.metadata) : "";
    return [
      String(row.created_at || ""),
      actorName,
      String(row.role || ""),
      String(row.action || ""),
      String(row.entity_type || ""),
      String(row.entity_id || ""),
      row.organization_id ?? "",
      metaJson,
    ];
  };

  const filename = csvFilename("audit", "log", {
    org: scopeOrg ?? null,
    action: wantedAction || null,
    entity: wantedEntity || null,
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

  const stream = streamCsvToResponse(headers, iterable, { maxRows: AUDIT_EXPORT_HARD_CAP }, {
    signal: streamSignal,
    onProgress: ({ rowsEmitted }) => {
      if (rowsEmitted > 0 && rowsEmitted % 500 === 0) {
        logger.info("export.audit.stream", "chunk progress", {
          rowsEmitted,
          organizationId: scopeOrg,
        });
      }
    },
    onComplete: (info) => {
      const durationMs = Date.now() - streamStartedAt;
      logger.info("export.audit.stream", "stream completed", {
        organizationId: scopeOrg,
        actorRole: role,
        rowCount: info.rowCount,
        truncated: info.truncated,
        cap: info.cap ?? AUDIT_EXPORT_HARD_CAP,
        durationMs,
      });
      reportExportRun({
        exportKind: "audit",
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
        exportKind: "audit",
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

  logger.info("export.audit.stream", "stream initiated", {
    organizationId: scopeOrg,
    actorRole: role,
    rateLimitAdapter: decision.adapter,
    queryRowCount: rows.length,
  });

  // Truncated bilgisini önceden hesapla (rows.length cap'i aşıyorsa
  // stream içinde truncated set olur; header sayfa açılırken set olmalı).
  const willTruncate =
    rows.length >= AUDIT_EXPORT_HARD_CAP;

  return new Response(stream, {
    status: 200,
    headers: buildCsvDownloadHeaders(filename, {
      rowCount: rows.length,
      cap: AUDIT_EXPORT_HARD_CAP,
      truncated: willTruncate,
    }),
  });
}
