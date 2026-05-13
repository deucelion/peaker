/**
 * Faz 12.1 — `export.audit` worker handler.
 *
 * Async export akışı:
 *   1. Worker payload'dan filter alır (organizationId scope, action, entity,
 *      fromIso, toIso). Sync action'la aynı şema.
 *   2. service-role ile audit_logs query (tenant scope filter explicit
 *      organization_id eq ile zorlanır — RLS by-pass'in compensating control'ü).
 *   3. CSV string üretir (sync path ile aynı `buildCsvFromRows` + format +
 *      header sırası).
 *   4. Supabase Storage `peaker-job-exports/<orgId>/<jobLogId>/audit-<stamp>.csv`
 *      olarak yükler.
 *   5. Kullanıcıya bildirim oluşturur (notifications.message ile; storagePath
 *      `peaker_jobs_log.result` jsonb'da tutulur).
 *
 * Parity:
 *   - Sync `exportAuditLogsCSV` action'ının CSV header sırası, separator,
 *     UTF-8 BOM, satır limiti birebir aynı (`AUDIT_EXPORT_HARD_CAP=5000`).
 *
 * Idempotency:
 *   - peaker_jobs_log.idempotency_key zaten unique;
 *     worker `peaker_jobs_mark_running` çağrısı duplicate execution'ı engeller.
 *   - Storage upload upsert=true; aynı path aynı içeriği overwrite eder.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { toDisplayName } from "@/lib/profile/displayName";
import { csvFilename } from "@/lib/export/csv";
import { buildCsvFromRows } from "@/lib/export/csvStream";
import { logger } from "@/lib/monitoring/logger";
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  type AuditAction,
  type AuditEntityType,
} from "@/lib/audit/types";
import type { WorkerHandler, WorkerHandlerResult, WorkerJobContext } from "./types";

const AUDIT_EXPORT_HARD_CAP = 5000;

type ExportAuditPayloadAttributes = {
  organizationId?: string | null;
  action?: string | null;
  entityType?: string | null;
  fromIso?: string | null;
  toIso?: string | null;
  initiatorUserId?: string | null;
};

function extractAttributes(ctx: WorkerJobContext): ExportAuditPayloadAttributes {
  const attrs = (ctx.payload?.attributes as Record<string, unknown> | undefined) ?? {};
  return {
    organizationId:
      typeof attrs.organizationId === "string" ? attrs.organizationId : ctx.organizationId,
    action: typeof attrs.action === "string" ? attrs.action : null,
    entityType: typeof attrs.entityType === "string" ? attrs.entityType : null,
    fromIso: typeof attrs.fromIso === "string" ? attrs.fromIso : null,
    toIso: typeof attrs.toIso === "string" ? attrs.toIso : null,
    initiatorUserId: typeof attrs.initiatorUserId === "string" ? attrs.initiatorUserId : null,
  };
}

function isIsoLike(v: string | null | undefined): boolean {
  if (!v) return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime());
}

export const exportAuditHandler: WorkerHandler = {
  kind: "export.audit",
  async run(ctx: WorkerJobContext): Promise<WorkerHandlerResult> {
    const attrs = extractAttributes(ctx);
    const adminClient = createSupabaseAdminClient();

    if (attrs.action && !AUDIT_ACTIONS.includes(attrs.action as AuditAction)) {
      throw new Error(`invalid audit action filter: ${attrs.action}`);
    }
    if (attrs.entityType && !AUDIT_ENTITY_TYPES.includes(attrs.entityType as AuditEntityType)) {
      throw new Error(`invalid audit entity filter: ${attrs.entityType}`);
    }
    if (attrs.fromIso && !isIsoLike(attrs.fromIso)) {
      throw new Error(`invalid fromIso: ${attrs.fromIso}`);
    }
    if (attrs.toIso && !isIsoLike(attrs.toIso)) {
      throw new Error(`invalid toIso: ${attrs.toIso}`);
    }

    let q = adminClient
      .from("audit_logs")
      .select("id, organization_id, user_id, role, action, entity_type, entity_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(AUDIT_EXPORT_HARD_CAP);
    if (attrs.organizationId) q = q.eq("organization_id", attrs.organizationId);
    if (attrs.action) q = q.eq("action", attrs.action);
    if (attrs.entityType) q = q.eq("entity_type", attrs.entityType);
    if (attrs.fromIso) q = q.gte("created_at", new Date(attrs.fromIso).toISOString());
    if (attrs.toIso) q = q.lte("created_at", new Date(attrs.toIso).toISOString());

    const { data, error } = await q;
    if (error) {
      const err = new Error(`audit_logs query failed: ${error.message}`);
      (err as Error & { errorKind?: string }).errorKind = "fetch_error";
      throw err;
    }

    const rows = data ?? [];
    const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
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
    const builtRows: ReadonlyArray<unknown>[] = [];
    for (const row of rows) {
      const a = actorMap.get(row.user_id);
      const actorName = toDisplayName(a?.full_name ?? null, a?.email ?? null, "Kullanıcı");
      const metaJson = row.metadata && typeof row.metadata === "object" ? JSON.stringify(row.metadata) : "";
      builtRows.push([
        String(row.created_at || ""),
        actorName,
        String(row.role || ""),
        String(row.action || ""),
        String(row.entity_type || ""),
        String(row.entity_id || ""),
        row.organization_id ?? "",
        metaJson,
      ]);
    }
    const built = buildCsvFromRows(headers, builtRows, { maxRows: AUDIT_EXPORT_HARD_CAP });
    const truncated = built.truncated || rows.length >= AUDIT_EXPORT_HARD_CAP;

    const filename = csvFilename("audit", "log", {
      org: attrs.organizationId ?? null,
      action: attrs.action || null,
      entity: attrs.entityType || null,
    });
    const storageOrgKey = attrs.organizationId ?? "global";
    const storagePath = `${storageOrgKey}/${ctx.logId}/${filename}`;

    const csvBytes = new TextEncoder().encode(built.csv);
    const { error: uploadError } = await adminClient.storage
      .from("peaker-job-exports")
      .upload(storagePath, csvBytes, {
        contentType: "text/csv; charset=utf-8",
        upsert: true,
        cacheControl: "300",
      });
    if (uploadError) {
      const err = new Error(`storage upload failed: ${uploadError.message}`);
      (err as Error & { errorKind?: string }).errorKind = "fetch_error";
      throw err;
    }

    if (attrs.initiatorUserId) {
      const message = `Audit dışa aktarımınız hazır: ${built.rowCount} satır${
        truncated ? ` (cap ${AUDIT_EXPORT_HARD_CAP} aşıldı)` : ""
      }.`;
      const { error: notifyError } = await adminClient
        .from("notifications")
        .insert({ user_id: attrs.initiatorUserId, message });
      if (notifyError) {
        logger.warn("worker.export.audit", "notification insert failed (non-fatal)", {
          jobLogId: ctx.logId,
          reason: notifyError.message,
        });
      }
    }

    logger.info("worker.export.audit", "csv built and uploaded", {
      jobLogId: ctx.logId,
      organizationId: attrs.organizationId,
      rowCount: built.rowCount,
      truncated,
      storagePath,
    });

    return {
      storagePath,
      rowCount: built.rowCount,
      truncated,
      summary: {
        filename,
        cap: AUDIT_EXPORT_HARD_CAP,
        bytes: csvBytes.byteLength,
      },
    };
  },
};
