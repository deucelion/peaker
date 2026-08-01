"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getSafeRole } from "@/lib/auth/roleMatrix";
import { resolveSessionActor } from "@/lib/auth/resolveSessionActor";
import { withServerActionGuard } from "@/lib/observability/serverActionError";
import { isUuid } from "@/lib/validation/uuid";
import { toDisplayName } from "@/lib/profile/displayName";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, type AuditAction, type AuditEntityType } from "@/lib/audit/types";
import type { AuditLogErrorKind, AuditLogFilter, AuditLogListItem } from "@/lib/actions/auditLogTypes";
import { csvFilename } from "@/lib/export/csv";
import { buildCsvFromRows } from "@/lib/export/csvStream";
import { logger } from "@/lib/monitoring";
import { reportAuditListFetch } from "@/lib/monitoring/advancedTelemetry";
import { auditDateEndIso, auditDateStartIso } from "@/lib/audit/auditQueryRange";
import { checkExportRateLimit } from "@/lib/rateLimit";
import { auditListUserMessage } from "@/lib/schemaCompat/userMessages";
import { assertExportFeatureForOrg } from "@/lib/auth/exportFeatureAccess";
import { EXPORT_ENDPOINT_IDS } from "@/lib/organization/features/surfaces/exportEntitlementMap";

const AUDIT_LIST_QUERY_TIMEOUT_MS = 25_000;

async function withAuditQueryTimeout<T>(promise: PromiseLike<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("audit_query_timeout")), AUDIT_LIST_QUERY_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Faz 2.2 — Admin/super_admin için audit log görüntüleme.
 *
 * Güvenlik:
 *   - Sadece admin (kendi org) veya super_admin görebilir.
 *   - Admin: yalnız kendi `organization_id`'sine ait kayıtlar.
 *   - Super admin: opsiyonel `organizationId` filtresi; verilmezse tümü.
 *
 * Veri bütünlüğü:
 *   - Salt okunur action; mevcut audit_logs tablosuna yazmaz.
 *   - audit_logs zaten RLS korumalı (`audit_logs_select_policy`); ekstra
 *     defansif filtre uygulanır (admin tenant outside RLS atlatılamaz).
 *
 * UX:
 *   - Sayfa boyutu max 200; default 50.
 *   - `metadata` jsonb sade str ile döner (UI tarafında pretty render).
 *
 * Tipler: `@/lib/actions/auditLogTypes` (Faz 15 — use server yalnızca async fn).
 */

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

function clampPage(p: number | undefined) {
  const n = Number(p) || 1;
  return n < 1 ? 1 : Math.floor(n);
}
function clampPageSize(p: number | undefined) {
  const n = Number(p) || DEFAULT_PAGE_SIZE;
  if (n < 1) return DEFAULT_PAGE_SIZE;
  if (n > MAX_PAGE_SIZE) return MAX_PAGE_SIZE;
  return Math.floor(n);
}

function isIsoLike(v: string | null | undefined): boolean {
  if (!v) return false;
  // YYYY-MM-DD veya tam ISO; Date constructor ile sınar.
  const d = new Date(v);
  return !Number.isNaN(d.getTime());
}

export async function listAuditLogsForActor(filter: AuditLogFilter = {}) {
  return withServerActionGuard("audit.listAuditLogsForActor", async () => {
    const resolved = await resolveSessionActor({ claimRequiresOrganization: false });
    if ("error" in resolved) {
      const copy = auditListUserMessage("auth_required", resolved.error);
      return { error: copy.description, errorKind: "auth_required" as AuditLogErrorKind, diagnosticsCode: copy.diagnosticsCode };
    }
    const role = getSafeRole(resolved.actor.role);
    if (role !== "admin" && role !== "super_admin") {
      const copy = auditListUserMessage("permission_denied");
      return {
        error: copy.description,
        errorKind: "permission_denied" as AuditLogErrorKind,
        diagnosticsCode: copy.diagnosticsCode,
      };
    }

    const adminClient = createSupabaseAdminClient();

    let scopeOrg: string | null = null;
    if (role === "admin") {
      if (!resolved.actor.organizationId) {
        const copy = auditListUserMessage("auth_required", "Organizasyon bilgisi alınamadı.");
        return {
          error: copy.description,
          errorKind: "auth_required" as AuditLogErrorKind,
          diagnosticsCode: copy.diagnosticsCode,
        };
      }
      scopeOrg = resolved.actor.organizationId;
    } else {
      const wantOrg = (filter.organizationId || "").trim();
      if (wantOrg && !isUuid(wantOrg)) {
        const copy = auditListUserMessage("invalid_input", "Geçersiz organizasyon filtresi.");
        return {
          error: copy.description,
          errorKind: "invalid_input" as AuditLogErrorKind,
          diagnosticsCode: copy.diagnosticsCode,
        };
      }
      scopeOrg = wantOrg || null;
    }

    const wantedAction = (filter.action || "").trim();
    const wantedEntity = (filter.entityType || "").trim();
    const wantedFrom = (filter.fromIso || "").trim();
    const wantedTo = (filter.toIso || "").trim();

    if (wantedAction && !AUDIT_ACTIONS.includes(wantedAction as AuditAction)) {
      const copy = auditListUserMessage("invalid_input", "Geçersiz audit eylem filtresi.");
      return { error: copy.description, errorKind: "invalid_input" as AuditLogErrorKind, diagnosticsCode: copy.diagnosticsCode };
    }
    if (wantedEntity && !AUDIT_ENTITY_TYPES.includes(wantedEntity as AuditEntityType)) {
      const copy = auditListUserMessage("invalid_input", "Geçersiz audit entity filtresi.");
      return { error: copy.description, errorKind: "invalid_input" as AuditLogErrorKind, diagnosticsCode: copy.diagnosticsCode };
    }
    if (wantedFrom && !isIsoLike(wantedFrom)) {
      const copy = auditListUserMessage("invalid_input", "Geçersiz başlangıç tarihi.");
      return { error: copy.description, errorKind: "invalid_input" as AuditLogErrorKind, diagnosticsCode: copy.diagnosticsCode };
    }
    if (wantedTo && !isIsoLike(wantedTo)) {
      const copy = auditListUserMessage("invalid_input", "Geçersiz bitiş tarihi.");
      return { error: copy.description, errorKind: "invalid_input" as AuditLogErrorKind, diagnosticsCode: copy.diagnosticsCode };
    }

    const page = clampPage(filter.page);
    const pageSize = clampPageSize(filter.pageSize);
    const fromIdx = (page - 1) * pageSize;
    const toIdx = fromIdx + pageSize - 1;

    let q = adminClient
      .from("audit_logs")
      .select("id, organization_id, user_id, role, action, entity_type, entity_id, metadata, created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(fromIdx, toIdx);

    if (scopeOrg) q = q.eq("organization_id", scopeOrg);
    if (wantedAction) q = q.eq("action", wantedAction);
    if (wantedEntity) q = q.eq("entity_type", wantedEntity);
    if (wantedFrom) q = q.gte("created_at", auditDateStartIso(wantedFrom));
    if (wantedTo) q = q.lte("created_at", auditDateEndIso(wantedTo));

    const startedAt = Date.now();
    let data;
    let error;
    let count;
    try {
      const result = await withAuditQueryTimeout(q);
      data = result.data;
      error = result.error;
      count = result.count;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isTimeout = msg === "audit_query_timeout";
      const errorKind: AuditLogErrorKind = isTimeout ? "timeout" : "fetch_error";
      logger.warn("audit.list", "list failed", {
        errorKind,
        scopeOrg,
        page,
        pageSize,
        durationMs: Date.now() - startedAt,
        timeout: isTimeout,
      });
      reportAuditListFetch({
        ok: false,
        errorKind,
        organizationId: scopeOrg,
        durationMs: Date.now() - startedAt,
        rowCount: 0,
      });
      const copy = auditListUserMessage(isTimeout ? "timeout" : "fetch_error");
      return {
        error: copy.description,
        errorKind,
        diagnosticsCode: copy.diagnosticsCode,
      };
    }

    if (error) {
      logger.warn("audit.list", "query error", {
        errorKind: "fetch_error",
        scopeOrg,
        code: error.code,
        message: error.message,
        durationMs: Date.now() - startedAt,
      });
      reportAuditListFetch({
        ok: false,
        errorKind: "fetch_error",
        organizationId: scopeOrg,
        durationMs: Date.now() - startedAt,
        rowCount: 0,
      });
      const copy = auditListUserMessage("fetch_error");
      return {
        error: copy.description,
        errorKind: "fetch_error" as AuditLogErrorKind,
        diagnosticsCode: copy.diagnosticsCode,
      };
    }

    const userIds = Array.from(new Set((data || []).map((r) => r.user_id).filter(Boolean))) as string[];
    let actorMap = new Map<string, { full_name: string | null; email: string | null }>();
    if (userIds.length > 0) {
      const { data: actors } = await adminClient
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      actorMap = new Map((actors || []).map((p) => [p.id, { full_name: p.full_name, email: p.email }]));
    }

    const items: AuditLogListItem[] = (data || []).map((row) => {
      const a = actorMap.get(row.user_id);
      return {
        id: String(row.id),
        organizationId: row.organization_id ?? null,
        userId: row.user_id,
        actorName: toDisplayName(a?.full_name ?? null, a?.email ?? null, "Kullanıcı"),
        role: String(row.role || ""),
        action: String(row.action || ""),
        entityType: String(row.entity_type || ""),
        entityId: String(row.entity_id || ""),
        metadata:
          row.metadata && typeof row.metadata === "object"
            ? (row.metadata as Record<string, unknown>)
            : {},
        createdAt: String(row.created_at || ""),
      };
    });

    const durationMs = Date.now() - startedAt;
    reportAuditListFetch({
      ok: true,
      errorKind: null,
      organizationId: scopeOrg,
      durationMs,
      rowCount: items.length,
    });
    logger.info("audit.list", "list ok", {
      scopeOrg,
      page,
      pageSize,
      total: count ?? items.length,
      durationMs,
    });

    return {
      items,
      total: count ?? items.length,
      page,
      pageSize,
      scope: { role, organizationId: scopeOrg },
    };
  });
}

/**
 * Faz 4.6 — Audit log CSV export.
 *
 * Aynı yetki çerçevesi: admin yalnız kendi org'unu, super_admin opsiyonel org filtresini görür.
 * Sayfalama yerine cap (5000 satır) — UI tarafında uyarı verilir.
 * Çıktı: CSV string + UTF-8 BOM + ; separator + CRLF.
 */
const AUDIT_EXPORT_HARD_CAP = 5000;

export async function exportAuditLogsCSV(filter: AuditLogFilter = {}) {
  return withServerActionGuard("audit.exportAuditLogsCSV", async () => {
    const resolved = await resolveSessionActor({ claimRequiresOrganization: false });
    if ("error" in resolved) {
      return { error: resolved.error, errorKind: "auth_required" as AuditLogErrorKind };
    }
    const role = getSafeRole(resolved.actor.role);
    if (role !== "admin" && role !== "super_admin") {
      return {
        error: "Audit kayıtlarını dışa aktarma yetkiniz yok.",
        errorKind: "permission_denied" as AuditLogErrorKind,
      };
    }

    const adminClient = createSupabaseAdminClient();

    let scopeOrg: string | null = null;
    if (role === "admin") {
      if (!resolved.actor.organizationId) {
        return { error: "Organizasyon bilgisi alınamadı.", errorKind: "auth_required" as AuditLogErrorKind };
      }
      scopeOrg = resolved.actor.organizationId;
    } else {
      const wantOrg = (filter.organizationId || "").trim();
      if (wantOrg && !isUuid(wantOrg)) {
        return { error: "Geçersiz organizasyon filtresi.", errorKind: "invalid_input" as AuditLogErrorKind };
      }
      scopeOrg = wantOrg || null;
    }

    const featureDenial = await assertExportFeatureForOrg(EXPORT_ENDPOINT_IDS.auditLogsCsv, scopeOrg);
    if (featureDenial) {
      return {
        error: featureDenial.error,
        errorKind: featureDenial.errorKind as AuditLogErrorKind,
      };
    }

    // Faz 11.7 — Rate limit: export kategori başına per-user + per-org koruma.
    const rateLimitDecision = checkExportRateLimit({
      userId: resolved.actor.id,
      organizationId: scopeOrg ?? "global",
      exportKind: "audit",
    });
    if (!rateLimitDecision.allowed) {
      return {
        error: `Audit dışa aktarımı için çok fazla istek yapıldı. Lütfen ${Math.ceil(rateLimitDecision.retryAfterMs / 1000)} saniye sonra tekrar deneyin.`,
        errorKind: "fetch_error" as AuditLogErrorKind,
      };
    }

    const wantedAction = (filter.action || "").trim();
    const wantedEntity = (filter.entityType || "").trim();
    const wantedFrom = (filter.fromIso || "").trim();
    const wantedTo = (filter.toIso || "").trim();
    if (wantedAction && !AUDIT_ACTIONS.includes(wantedAction as AuditAction)) {
      return { error: "Geçersiz audit eylem filtresi.", errorKind: "invalid_input" as AuditLogErrorKind };
    }
    if (wantedEntity && !AUDIT_ENTITY_TYPES.includes(wantedEntity as AuditEntityType)) {
      return { error: "Geçersiz audit entity filtresi.", errorKind: "invalid_input" as AuditLogErrorKind };
    }
    if (wantedFrom && !isIsoLike(wantedFrom)) {
      return { error: "Geçersiz başlangıç tarihi.", errorKind: "invalid_input" as AuditLogErrorKind };
    }
    if (wantedTo && !isIsoLike(wantedTo)) {
      return { error: "Geçersiz bitiş tarihi.", errorKind: "invalid_input" as AuditLogErrorKind };
    }

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
      return {
        error: `Audit kayıtları alınamadı: ${error.message}`,
        errorKind: "fetch_error" as AuditLogErrorKind,
      };
    }

    const userIds = Array.from(new Set((data || []).map((r) => r.user_id).filter(Boolean))) as string[];
    let actorMap = new Map<string, { full_name: string | null; email: string | null }>();
    if (userIds.length > 0) {
      const { data: actors } = await adminClient
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      actorMap = new Map((actors || []).map((p) => [p.id, { full_name: p.full_name, email: p.email }]));
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
    // Faz 11.4 — Streaming-friendly chunked iterable (500 satırlık chunk'lar).
    // Aynı sink kullanılır (in-memory), ama memory burst azaltılır ve Faz 12
    // route handler'larında doğrudan `streamCsvToResponse` ile değiştirilebilir.
    const fetchedRows = data || [];
    const buildAuditRow = (row: typeof fetchedRows[number]): ReadonlyArray<unknown> => {
      const a = actorMap.get(row.user_id);
      const actorName = toDisplayName(a?.full_name ?? null, a?.email ?? null, "Kullanıcı");
      const metaJson = row.metadata && typeof row.metadata === "object" ? JSON.stringify(row.metadata) : "";
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
    const builtRows: ReadonlyArray<unknown>[] = [];
    for (let i = 0; i < fetchedRows.length; i += 500) {
      const chunk = fetchedRows.slice(i, i + 500);
      for (const r of chunk) builtRows.push(buildAuditRow(r));
    }
    const built = buildCsvFromRows(headers, builtRows, { maxRows: AUDIT_EXPORT_HARD_CAP });
    const filename = csvFilename("audit", "log", {
      org: scopeOrg ?? null,
      action: wantedAction || null,
      entity: wantedEntity || null,
    });
    const truncated = built.truncated || (data?.length ?? 0) >= AUDIT_EXPORT_HARD_CAP;
    logger.info("export.audit", "audit csv built", {
      rowCount: built.rowCount,
      truncated,
      cap: AUDIT_EXPORT_HARD_CAP,
      organizationId: scopeOrg,
    });
    return {
      csv: built.csv,
      filename,
      rowCount: built.rowCount,
      truncated,
      cap: AUDIT_EXPORT_HARD_CAP,
    };
  });
}
